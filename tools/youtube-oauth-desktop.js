'use strict';
// TYLKO lokalny Windows/macOS/Linux: bezpieczne OAuth Desktop + PKCE + 127.0.0.1.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {createInterface}=require('node:readline/promises');
const TOKEN_URL='https://oauth2.googleapis.com/token';
const DEST=path.resolve(__dirname,'..','.env.youtube-oauth.local');
async function main(){
  console.log('BOBER MUSIC BOT: YouTube OAuth (dane konta, bez audio). Uruchamiaj lokalnie, NIE na Bot-Hosting.net.');
  const rl=createInterface({input:process.stdin,output:process.stdout});
  let file=process.argv[2];
  try{if(!file)file=await rl.question('Ścieżka pobranego z Google Cloud pliku JSON typu Desktop app: ');}
  finally{rl.close();}
  file=String(file||'').trim().replace(/^"|"$/g,'');
  if(!file)throw Error('Brak ścieżki do pliku JSON.');
  const creds=JSON.parse(fs.readFileSync(path.resolve(file),'utf8')).installed;
  if(!creds?.client_id||!creds?.client_secret||!/\.apps\.googleusercontent\.com$/.test(creds.client_id))
    throw Error('Wymagany JSON klienta Google typu Desktop app, nie Web/Android.');
  const state=crypto.randomBytes(24).toString('base64url');
  const verifier=crypto.randomBytes(48).toString('base64url');
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  let resolveCallback,rejectCallback;
  const callback=new Promise((resolve,reject)=>{resolveCallback=resolve;rejectCallback=reject;});
  const server=http.createServer((req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname!=='/oauth2callback'){res.writeHead(404);res.end();return;}
      if(url.searchParams.get('state')!==state){res.writeHead(400);res.end('Bad state');return;}
      if(url.searchParams.has('error')||!url.searchParams.has('code')){
        res.writeHead(400);res.end('Authentication cancelled');rejectCallback(Error('Nie udzielono zgody Google.'));return;
      }
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      res.end('<meta charset="utf-8"><p>Połączono YouTube. Możesz zamknąć tę stronę.</p>');
      resolveCallback(url.searchParams.get('code'));
    }catch(e){res.writeHead(400);res.end();rejectCallback(e);}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const redirectUri='http://127.0.0.1:'+server.address().port+'/oauth2callback';
  const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v] of Object.entries({client_id:creds.client_id,redirect_uri:redirectUri,response_type:'code',
    scope:'https://www.googleapis.com/auth/youtube.readonly',access_type:'offline',prompt:'consent',
    state,code_challenge:challenge,code_challenge_method:'S256'}))auth.searchParams.set(k,v);
  console.log('Otwórz na TYM SAMYM komputerze adres:');
  console.log(auth.toString());
  let timer;
  try{
    const code=await Promise.race([callback,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Minął czas autoryzacji.')),5*60*1000);})]);
    const res=await fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({code,client_id:creds.client_id,client_secret:creds.client_secret,
        redirect_uri:redirectUri,grant_type:'authorization_code',code_verifier:verifier}),
      signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw Error('Google odmówiło tokenu (HTTP '+res.status+'). Sprawdź OAuth Desktop i ekran zgody.');
    const data=await res.json();
    if(!data.refresh_token)throw Error('Google nie zwróciło refresh_token. Spróbuj ponownie udzielić zgody.');
    const env='YOUTUBE_OAUTH_CLIENT_ID='+creds.client_id+'\nYOUTUBE_OAUTH_CLIENT_SECRET='+creds.client_secret+
      '\nYOUTUBE_OAUTH_REFRESH_TOKEN='+data.refresh_token+'\n';
    fs.writeFileSync(DEST,env,{encoding:'utf8',mode:0o600});
    console.log('✅ Zapisano prywatny plik: '+DEST);
    console.log('Skopiuj jego trzy linie TYLKO do .env na Bot-Hosting.net. NIGDY na GitHub ani do czatu.');
  }finally{clearTimeout(timer);server.close();}
}
main().catch(e=>{console.error('❌ '+e.message);process.exitCode=1;});
