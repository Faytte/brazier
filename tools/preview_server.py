"""Render real Brazier files with explicit simulated Foundry APIs; loopback only."""
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import unquote,urlparse
import argparse,hashlib,mimetypes,json,base64,re
ROOT=Path(__file__).resolve().parents[1]
ALLOWED={'scripts','styles','assets','templates'}
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  path=unquote(urlparse(self.path).path).lstrip('/')
  if path=='__version':
   paths=[*ROOT.glob('scripts/*.mjs'),*ROOT.glob('styles/*.css'),*ROOT.glob('templates/*.hbs'),*ROOT.glob('tests/preview/*')]
   data=hashlib.sha256('|'.join(str(p.stat().st_mtime_ns) for p in sorted(paths)).encode()).hexdigest().encode();mime='text/plain'
  else:
   if not path:path='tests/preview/index.html'
   if path.startswith('modules/brazier/'):path=path[len('modules/brazier/'):]
   target=(ROOT/path).resolve()
   if not target.is_relative_to(ROOT) or not target.is_file() or not (path.split('/')[0] in ALLOWED or path.startswith(('tests/preview/','tests/vendor/'))):self.send_error(404);return
   data=target.read_bytes();mime='text/javascript' if target.suffix in {'.js','.mjs'} else mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
  self.send_response(200);self.send_header('Content-Type',mime+'; charset=utf-8' if mime.startswith('text/') else mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
 def do_POST(self):
  # Evidence export is a development-only, same-origin form. It never writes module/world data.
  if self.path!='/__evidence' or self.headers.get('Origin')!=f'http://127.0.0.1:{self.server.server_port}' or self.headers.get('Content-Type')!='application/json':self.send_error(403);return
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 0<length<8000000:raise ValueError('Invalid size')
   payload=json.loads(self.rfile.read(length));name=payload['name']
   if not re.fullmatch(r'[a-z0-9-]{1,60}',name):raise ValueError('Invalid name')
   data=base64.b64decode(payload['png'],validate=True)
   extension='png' if data.startswith(b'\x89PNG\r\n\x1a\n') else 'jpg' if data.startswith(b'\xff\xd8\xff') else None
   if not extension:raise ValueError('Expected screenshot image')
   output=ROOT.parent/'brazier-roadmap'/f'{name}.{extension}';output.write_bytes(data)
   self.send_response(200);self.send_header('Content-Type','text/plain');self.end_headers();self.wfile.write(str(output).encode())
  except (ValueError,KeyError,OSError):self.send_error(400)
 def log_message(self,*args):pass
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--port',type=int,default=8765);args=p.parse_args()
 print(f'Brazier development preview: http://127.0.0.1:{args.port}',flush=True)
 print('Actual module rendering; simulated documents and preparation APIs. No license required.',flush=True)
 try:ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
 except KeyboardInterrupt:pass
