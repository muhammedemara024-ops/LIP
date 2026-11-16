"""PD-047 Revision 3: read-only proposal validation, never an execution authorizer."""
import base64, copy, hashlib, json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2] if "__file__" in globals() and not str(__file__).startswith("<") else Path.cwd()
PROPOSAL = ROOT / "specs/002-p0-prd/backend-first-amendment.md"
text = base64.b64decode(sys.argv[sys.argv.index("--draft-base64")+1]).decode("utf-8") if "--draft-base64" in sys.argv else PROPOSAL.read_text(encoding="utf-8")
source = (ROOT/"specs/002-p0-prd/tasks.md").read_text(encoding="utf-8")
matches = re.findall(r"### 4\.1 Proposed dependency manifest\s+[\s\S]*?\x60{3}json\s+([\s\S]*?)\s+\x60{3}", text)
assert len(matches)==1, "one graph manifest required"
model=json.loads(matches[0]); assert model["schema"]=="pd047-revision3.graph.v1"
checks=[]
def check(name, ok, detail=None):
    assert ok, (name,detail)
    checks.append({"check":name,"result":"PASS", **({"detail":detail} if detail is not None else {})})
blocks=re.split(r"(?m)^- \[ \] (T\d{3}) ",source);cards={}
for i in range(1,len(blocks),2):
    key,body=blocks[i],blocks[i+1]
    assert key not in cards, "duplicate card "+key
    pre=re.search(r"(?m)^  - Prerequisites:(.*)$",body);assert pre
    # Current T080 cites its own execution-brief section; T028 describes its own tests.
    # Remove only those verified narrative phrases, never a prerequisite-list self edge.
    dep_text=pre[1].replace("§ "+key,"§ <self-section>").replace(key+" implements and tests","<self> implements and tests")
    cards[key]={"pre":set(re.findall(r"\bT\d{3}\b",dep_text)),"gates":set(),"text":pre[1]}
check("current task inventory",len(cards)==82,len(cards))
register={}
for line in source.split("## Gate register",1)[1].split("\n## ",1)[0].splitlines():
    if not line.startswith("| ") or line.startswith("| ---") or line.startswith("| Gate"):continue
    columns=line.strip().strip("|").split("|")
    register[columns[0].strip().strip(chr(96))]=set(re.findall(r"\bT\d{3}\b",columns[-1]))
closed={"bff-money-home","stage-cells","rebrand-brief","dependency-brief"}
for card in cards.values():
    for name in (set(register)-closed)|{"G-IMPLEMENT","M1","feature-checklist"}:
        if re.search(r"(?<![\w-])"+re.escape(name)+r"(?![\w-])",card["text"]):card["gates"].add(name)
    card["gates"].update(re.findall(r"\b(?:OD-\d{2}(?:-if-S1-fails)?|F-01|FP-003-(?:[a-e]|V[56])|SC-017)\b",card["text"]))
for gate,direct in register.items():
    if gate not in closed:
        for key in direct:
            assert key in cards, ("unknown registered card",gate,key)
            cards[key]["gates"].add(gate)
original_gates={key:set(card["gates"]) for key,card in cards.items()}
for key,values in model["remove_prerequisites"].items():
    check("remove documented prerequisite "+key,set(values)<=cards[key]["pre"])
    cards[key]["pre"].difference_update(values)
for key,values in model["add_prerequisites"].items():cards[key]["pre"].update(values)
for key,values in model["remove_gates"].items():
    missing=set(values)-cards[key]["gates"]
    assert not missing or (key in {"T010","T035","T048"} and missing=={"M1"}),(key,missing)
    cards[key]["gates"].difference_update(values)
for card in cards.values():card["gates"]={model["rename_gates"].get(g,g) for g in card["gates"]}
for key,values in model["add_gates"].items():cards[key]["gates"].update(values)
for key,values in model["new_cards"].items():
    assert key not in cards,"new id collision "+key
    cards[key]={"pre":set(values["prerequisites"]),"gates":set(values["gates"])}
ws={key:stream for stream,keys in model["workstreams"].items() for key in keys}
all_ws=[key for keys in model["workstreams"].values() for key in keys]
check("85 unique cards / complete workstream assignment",len(cards)==85 and set(ws)==set(cards) and len(all_ws)==len(set(all_ws)))
check("all task references resolve and no self prerequisite",all(p in cards and p!=key for key,card in cards.items() for p in card["pre"]),[(key,p,cards[key].get("text")) for key,card in cards.items() for p in card["pre"] if p not in cards or p==key])
task_graph={key:set(card["pre"]) for key,card in cards.items()}
def cycle(graph):
    state={}
    def visit(key,stack):
        if state.get(key)==1:return stack+[key]
        if state.get(key)==2:return None
        state[key]=1
        for dep in sorted(graph.get(key,set())):
            found=visit(dep,stack+[key])
            if found:return found
        state[key]=2
    for key in sorted(graph):
        found=visit(key,[])
        if found:return found
    return None
check("task graph acyclic",cycle(task_graph) is None)
graph={key:set(card["pre"])|{"g:"+g for g in card["gates"]} for key,card in cards.items()}
for gate,deps in model["gate_dependencies"].items():
    expanded=set()
    for dep in deps:
        if dep.startswith("workstream:"):expanded.update(model["workstreams"][dep.split(":",1)[1]])
        else:expanded.add(dep)
    graph["g:"+gate]=expanded
for deps in list(graph.values()):
    for dep in deps:
        if dep.startswith(("e:","g:")):graph.setdefault(dep,set())
        else:assert dep in cards,"unknown expanded dependency "+dep
check("expanded task/gate/milestone graph acyclic",cycle(graph) is None,cycle(graph))
def ancestors(key, graph=graph):
    seen=set()
    def walk(node):
        for dep in graph.get(node,set()):
            if dep not in seen:seen.add(dep);walk(dep)
    walk(key);return seen
ui={"T011","T026","T042","T045","T082","T083"}
backend={key for key,stream in ws.items() if stream in {"W1","W2","W3","W4","W5"}}
ui_gates={"g:ui-entry","g:M1-UI","g:M1-done","g:ux-brief","g:prototype","g:accessibility"}
check("backend has no UI card or UI gate ancestry",all(not(ancestors(key)&(ui|{"T084"}|ui_gates)) for key in backend))
order={"W1":1,"W2":2,"W3":3,"W4":4,"W5":5,"W6":6,"W7":7,"G":8}
check("no backward cross-workstream task edges",all(order[ws[p]]<=order[ws[key]] for key,card in cards.items() for p in card["pre"]))
check("T084 precedes ui-entry and has no UI evidence ancestry","T084" in ancestors("g:ui-entry") and not(ancestors("T084")&(ui|ui_gates|{"T085","g:M4"})))
check("UI entry excludes its own implemented outputs",not(ancestors("g:ui-entry")&(ui|{"T085","g:M1-done","g:M4"})))
check("staging waits for theming and live OTP without release cycle",{"T082","T057","T053"}<=ancestors("T085") and not(ancestors("T085")&{"g:M1-done","g:M4","T055","T056"}))
check("PM-6 backend entry excludes UI and full PM completion",all(not(ancestors(key)&ui_gates) for key in ["T040","T041","T043"]))
check("PM-9 backend proof precedes UI/final acceptance","g:PM-9-backend-entry" in ancestors("T054") and not(ancestors("T054")&{"g:M4","g:PM-9-final-entry","T085"}))
check("final security follows M4, complete PM-6/7/8 and live adapters",{"g:M4","g:PM-9-final-entry","g:PM-6-complete","g:PM-7-complete","g:PM-8-complete","T085","T057"}<=ancestors("T055"))
measurement_conditions={"g:F-02","g:F-11","g:A11Y-01","g:data-use-authorization","e:owner-staging-protocol-and-placement-approval"}
check("T085 measurement permissions fully expanded",measurement_conditions<=ancestors("T085"))
check("pilot follows UX completion and security",{"g:M1-done","g:M-01-M5","T085","T055"}<=ancestors("T056"))
check("T001 output is not its own entry requirement","T001" not in ancestors("g:backend-entry"))
check("every later implementation card inherits T001",all("T001" in ancestors(key) for key in set(cards)-set(model["workstreams"]["G"])-{"T001"}))
lost=[]
for key,gates in original_gates.items():
    for gate in gates:
        if gate in model["remove_gates"].get(key,[]):continue
        if model["rename_gates"].get(gate,gate) not in cards[key]["gates"]:lost.append([key,gate])
check("no unintended gate-register/card assignment loss",not lost,lost)
check("T027 UX assignments transferred to T083",{"ux-brief","accessibility"}<=cards["T083"]["gates"] and not(cards["T027"]["gates"]&{"ux-brief","accessibility","prototype"}))
content=set(model["historical_content_approved"]);allowed={"G-IMPLEMENT","backend-entry","feature-checklist"}
done=set();waves=[]
while True:
    wave=sorted(key for key in content-done if cards[key]["pre"]<=done and cards[key]["gates"]<=allowed)
    if not wave:break
    waves.append(wave);done.update(wave)
check("hypothetical first batch only after approvals",waves==model["proposed_first_batch"],waves)
check("historical implementation authorization preserved",set(model["historical_implementation_authorized"])=={"T010","T035","T048"})
counterexamples={}
for name,owner,dep in [
    ("T084 waits for ui-entry","T084","g:ui-entry"),
    ("UI entry waits for staging UX","g:M1-UI","T085"),
    ("T083 waits for downstream staging acceptance","T083","T085"),
    ("backend wizard waits for UI transport","T027","T011"),
    ("T084 self prerequisite","T084","T084"),
    ("PM-6 backend deletion inherits UI entry","T041","g:PM-6-UI-entry"),
    ("PM-9 backend proof inherits final M4 entry","T054","g:PM-9-final-entry")]:
    bad=copy.deepcopy(graph);bad[owner].add(dep);found=cycle(bad)
    assert found,"counterexample not detected "+name
    counterexamples[name]={"result":"REJECTED","cycle":found}
for missing in ["g:F-02","g:data-use-authorization"]:
    bad={key:deps-{missing} for key,deps in graph.items()}
    assert not(measurement_conditions<=ancestors("T085",bad)), "missing measurement condition was not caught"
    counterexamples["missing "+missing]={"result":"REJECTED","missing_condition":missing}
check("seven cycle and two missing-condition regressions rejected",len(counterexamples)==9)
required=["PD-047 is not approved or applied","its independent review remains an **open gate**","No repeat choice requested",
"0 ready / 85 blocked / 0 draft","WCAG 2.2 AA","all seven raw timing markers","≤2 taps","<15 min","<3 min",
"360 and 320 px","200 % text","OTP paste/autofill","FP-003","D-1–D-7","T084 is upstream of that gate","Fable has no prospective role"]
check("document scope/acceptance/governance sentinels",all(value in text for value in required),[value for value in required if value not in text])
for obsolete in ["choose U-a or U-b","Prerequisites: T002, "+chr(96)+"ui-entry"+chr(96)]:
    assert obsolete not in text,"stale prospective condition "+obsolete
baseline=(ROOT/".scratch/backend-first-20261115-revision3/revision2-baseline.md").read_text(encoding="utf-8")
identifier_pattern=r"\b(?:FR-\d{3}|SC-\d{3}|US\d+(?:\.\d+)?|PD-\d{3})\b"
lost_identifiers=sorted(set(re.findall(identifier_pattern,baseline))-set(re.findall(identifier_pattern,text)))
check("historical requirement and decision identifiers retained",not lost_identifiers,lost_identifiers)
links=re.findall(r"\]\(([^)]+)\)",text);missing=[]
for link in links:
    if "://" not in link and not link.startswith("#") and not(PROPOSAL.parent/link.split("#",1)[0]).exists():missing.append(link)
expected={"../../.scratch/backend-first-20261115-revision3/"+name for name in ["validation.md","graph_v3.py","revision2-baseline.md","review-brief.md"]}
check("local links resolve or are named companion outputs",set(missing)<=expected,missing)
print(json.dumps({"status":"PASS","environment":"Windows; Python "+sys.version.split()[0]+"; read-only in-memory graph analysis",
"source_tasks_sha256":hashlib.sha256(source.encode()).hexdigest(),"proposal_sha256":hashlib.sha256(text.encode()).hexdigest(),
"task_cards":len(cards),"task_edges":sum(map(len,task_graph.values())),"expanded_nodes":len(graph),"expanded_edges":sum(map(len,graph.values())),
"positive_checks_passed":len(checks),"positive_checks_failed":0,"negative_counterexamples_rejected":len(counterexamples),"negative_cycle_cases":7,"negative_missing_condition_cases":2,
"current_ready_cards":0,"independent_review":"not assessed by this validator; see validation.md","checks":checks,"counterexamples":counterexamples,
"hypothetical_authorized_batch":waves},ensure_ascii=False,indent=2))
