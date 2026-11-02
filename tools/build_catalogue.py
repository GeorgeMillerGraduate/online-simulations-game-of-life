from pathlib import Path
import zipfile,re,json,gzip,hashlib,sys
r=Path(__file__).resolve().parents[1];(r/'patterns').mkdir(exist_ok=True);(r/'licenses').mkdir(exist_ok=True)
z=zipfile.ZipFile(sys.argv[1]);out=[];skipped=[]
for n in z.namelist():
 if '/Patterns/' not in n or n.endswith('/'):continue
 rel=n.split('/Patterns/',1)[1];data=z.read(n)
 if n.endswith('.gz'):
  try:data=gzip.decompress(data);rel=rel[:-3]
  except:continue
 ext=rel.rsplit('.',1)[-1].lower()
 if ext not in ['rle','mc','mcl','lif']:continue
 text=data.decode('utf-8',errors='replace');rule=None
 if ext=='mcl':
  m=re.search(r'^#GOLLY\s+(.+)',text,re.M);rule=m.group(1).strip() if m else None
 elif ext=='mc':
  m=re.search(r'^#R\s+(.+)',text,re.M);rule=m.group(1).strip() if m else 'B3/S23'
 elif ext=='lif':
  m=re.search(r'^#R\s+(.+)',text,re.M);rule=m.group(1).strip() if m else 'B3/S23'
 else:
  m=re.search(r'^x\s*=.*',text,re.M|re.I);m=re.search(r'rule\s*=\s*(.+)',m.group() if m else '',re.I);rule=m.group(1).strip() if m else 'B3/S23'
 if rule=='23/3':rule='B3/S23'
 if rule=='Life':rule='B3/S23'
 if not (rule=='WireWorld' or re.fullmatch(r'B[1-8]*/S[0-8]*',rule or '',re.I)):
  skipped.append({'file':rel,'rule':rule});continue
 # Keep files intact, including creator comments and rule declarations.
 p=r/'patterns'/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 name=Path(rel).stem;title=re.search(r'^#N\s+(.+)',text,re.M)
 out.append({'name':name.replace('-',' '),'file':'patterns/'+rel,'folder':str(Path(rel).parent),'rule':rule,'source':rel,'bytes':len(data)})
(r/'patterns/index.json').write_text(json.dumps(out,indent=2));(r/'patterns/unsupported.json').write_text(json.dumps(skipped,indent=2));(r/'licenses/Golly-License.html').write_bytes(z.read('golly-5.0-win-64bit/License.html'))
print(len(out),'catalogued patterns;',len(skipped),'unsupported rule/format variants excluded')
