import re
import pathlib
root = pathlib.Path('backend')
route_dir = root / 'src' / 'routes'
service_file = pathlib.Path('frontend/src/services/api.js')
server_file = root / 'server.js'

server_text = server_file.read_text(encoding='utf-8')
reg = re.findall(r"app\.use\('(/api[^']*)',\s*require\('./src/routes/([^']+)'\)\)", server_text)
registered = {path: name for path, name in reg}
registered_paths = set(path for path, name in reg)
registered_files = {name + '.js': path for path, name in reg}
route_files = sorted([p.name for p in route_dir.glob('*.js')])
not_registered = [f for f in route_files if f not in registered_files]
route_endpoints = {}
for p in route_dir.glob('*.js'):
    text = p.read_text(encoding='utf-8', errors='ignore')
    eps = re.findall(r"router\.(get|post|put|delete|patch)\(\s*['\"]([^'\"]+)['\"]", text)
    route_endpoints[p.name] = eps
service_text = service_file.read_text(encoding='utf-8')
service_paths = set()
for m in re.finditer(r'fetch\(`\$\{API_BASE_URL\}(/[^`]+)`', service_text):
    service_paths.add(m.group(1).split('?')[0])
for m in re.finditer(r'fetch\(API_BASE_URL \+ \"(/[^\"\n]+)\"', service_text):
    service_paths.add(m.group(1).split('?')[0])
for m in re.finditer(r'fetch\(\s*`\$\{API_BASE_URL\}(/[^`]+)`', service_text):
    service_paths.add(m.group(1).split('?')[0])
sql_dir = pathlib.Path('database')
create_tables = set()
for f in sql_dir.glob('*.sql'):
    t = f.read_text(encoding='utf-8', errors='ignore')
    for m in re.findall(r'CREATE TABLE IF NOT EXISTS\s+([\w_]+)|CREATE TABLE\s+([\w_]+)', t, re.I):
        name = m[0] or m[1]
        if name:
            create_tables.add(name.lower())
route_table_refs = {}
route_sql_table_refs = {}
for p in route_dir.glob('*.js'):
    text = p.read_text(encoding='utf-8', errors='ignore')
    refs = re.findall(r"\b(?:FROM|JOIN|UPDATE|INTO|DELETE FROM|INSERT INTO|TRUNCATE TABLE)\s+([\w_]+)\b", text, re.I)
    route_table_refs[p.name] = sorted(set(r.lower() for r in refs))
    sql_refs = set()
    for m in re.finditer(r"\.(?:query|execute|client\.query)\(\s*(['\"`])([\s\S]*?)\1", text):
        query_text = m.group(2)
        for tname in re.findall(r"\b(?:FROM|JOIN|UPDATE|INTO|DELETE FROM|INSERT INTO|TRUNCATE TABLE)\s+([\w_]+)\b", query_text, re.I):
            sql_refs.add(tname.lower())
    route_sql_table_refs[p.name] = sorted(sql_refs)
all_files = [p for p in list(pathlib.Path('.').rglob('*.js')) + list(pathlib.Path('.').rglob('*.jsx')) if 'node_modules' not in str(p)]
envs = set()
for f in all_files:
    t = f.read_text(encoding='utf-8', errors='ignore')
    envs.update(re.findall(r'process\.env\.([A-Z_][A-Z0-9_]*)', t))
data_json = sorted([str(p.relative_to(root)) for p in root.rglob('*.json') if 'node_modules' not in str(p)])
mongoose_files = []
mongo_uris = set()
for p in [p for p in root.rglob('*.js') if 'node_modules' not in str(p)]:
    text = p.read_text(encoding='utf-8', errors='ignore')
    if "require('mongoose')" in text or 'require(\"mongoose\")' in text or 'mongoose.Schema' in text:
        if len(p.parts) >= 3 and p.parts[-3] == 'src' and p.parts[-2] == 'models':
            mongoose_files.append(str(p.relative_to(root)))
    for m in re.findall(r"mongodb:\/\/[^'\"\s]+", text):
        mongo_uris.add(m)
missing_service_routes = []
for path in sorted(service_paths):
    api_path = '/api' + path
    if not any(api_path == prefix or api_path.startswith(prefix + '/') for prefix in registered_paths):
        missing_service_routes.append(path)
print('REGISTERED_ROUTES')
for path,name in reg:
    print(f'{path} -> {name}')
print('\nNOT_REGISTERED_ROUTE_FILES')
print(not_registered)
print('\nSERVICE_ENDPOINT_ROOTS')
for p in sorted(service_paths):
    print(p)
print('\nMISSING_SERVICE_ROUTE_ROOTS')
for p in missing_service_routes:
    print(p)
print('\nJSON_FILES')
for p in data_json:
    print(p)
print('\nMONGOOSE_FILES')
for p in mongoose_files:
    print(p)
print('\nMONGO_URIS')
for uri in sorted(mongo_uris):
    print(uri)
print('\nENV_VARS')
for v in sorted(envs):
    print(v)
print('\nSQL_TABLES')
for t in sorted(create_tables):
    print(t)
print('\nROUTE_TABLE_REFS')
for k,v in sorted(route_table_refs.items()):
    if v:
        print(k, v)
print('\nROUTE_SQL_TABLE_REFS')
for k,v in sorted(route_sql_table_refs.items()):
    if v:
        print(k, v)
