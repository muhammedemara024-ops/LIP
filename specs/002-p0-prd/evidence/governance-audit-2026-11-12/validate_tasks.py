"""Read-only structural/traceability checks of the generated planning artifact."""
from pathlib import Path
import re,json,hashlib,subprocess
root=Path(__file__).resolve().parents[2]
feature=root/'specs/002-p0-prd'
doc=(feature/'tasks.md').read_text(encoding='utf-8')
spec=(feature/'spec.md').read_text(encoding='utf-8')
blocks=re.split(r'(?m)^- \[ \] (T\d{3}) ',doc)
cards={blocks[i]:blocks[i+1].split('\n## ')[0] for i in range(1,len(blocks),2)}
checks=[]
def check(name,ok):
 checks.append({'check':name,'pass':bool(ok)})
 if not ok: raise AssertionError(name)
check('sequential unique checklist IDs',list(cards)==[f'T{i:03}' for i in range(1,79)])
fields=['Readiness','Executor','Objective','Scope','Prerequisites','Implementation steps','Contracts','Invariants','Edge cases and required outcomes','Tests','Acceptance criteria','Verification','Failure handling']
check('all cards contain rule05 fields',all(all(f'  - {f}:' in s for f in fields) for s in cards.values()))
check('no card falsely executable',all('Readiness: blocked (G-IMPLEMENT' in s and 'Executor: blocked;' in s for s in cards.values()))
edges={}
for ident,body in cards.items():
 line=next(x for x in body.splitlines() if '  - Prerequisites:' in x)
 edges[ident]=re.findall(r'T\d{3}',line)
check('all dependency edges resolve and point earlier',all(dep in cards and dep<ident for ident,deps in edges.items() for dep in deps))
visiting=set();done=set()
def visit(ident):
 if ident in visiting: raise AssertionError('dependency cycle')
 if ident in done:return
 visiting.add(ident)
 for d in edges[ident]:visit(d)
 visiting.remove(ident);done.add(ident)
for ident in cards:visit(ident)
check('dependency graph acyclic',len(done)==78)
needed=set(re.findall(r'^- \*\*((?:FR|SC)-\d+)\*\*',spec,re.M))
objective={i:next(x for x in s.splitlines() if '  - Objective:' in x) for i,s in cards.items()}
covered=set(re.findall(r'(?:FR|SC)-\d+', '\n'.join(objective.values())))
check('127 requirement IDs mapped without invented IDs',covered==needed and len(needed)==127)
check('14 story labels preserved',set(re.findall(r'^- \[ \] T\d{3} \[(US\d+)\]',doc,re.M))=={f'US{i}' for i in range(1,15)})
check('18 unresolved OD gate records preserved',sum('Keep OD-' in s for s in cards.values())==18 and all(f'Keep OD-{i:02} unresolved' in doc for i in range(1,19)))
check('FP003 unscheduled and no algorithm steps', 'no FP-003 code, reversal formula, enablement steps or implementation schedule' in cards['T078'])
check('no unfinished template placeholders',not re.search(r'\[FEATURE NAME\]|\[n\]|<title>|\[Example|\bTODO\b|\bTKTK\b',doc))
missing=[]
for target in re.findall(r'\]\(([^)]+)\)',doc):
 if '://' not in target and not target.startswith('#') and not (feature/target.split('#')[0]).exists():missing.append(target)
check('Markdown local link targets exist',not missing)
check('no trailing whitespace',all(line.rstrip()==line for line in doc.splitlines()))
raw=subprocess.check_output(['git','diff','--cached','--raw'],cwd=root,text=True).strip()
check('staged gitattributes preserved',raw==':000000 100644 0000000 f843449 A\t.gitattributes')
check('no hooks configured',not (root/'.specify/extensions.yml').exists())
print(json.dumps({'checks_passed':len(checks),'checks_failed':0,'cards':len(cards),'dependency_edges':sum(map(len,edges.values())),'requirements':len(needed),'ready':0,'blocked':78,'draft':0,'sha256':hashlib.sha256(doc.encode()).hexdigest(),'checks':checks},indent=2))
