'use strict';
// Spotify Web API Client Credentials: metadane, nie audio dla Discorda.
const TOKEN_URL='https://accounts.spotify.com/api/token';
const API_URL='https://api.spotify.com/v1/tracks/';
let cached=null;
function config(env=process.env){
  const clientId=String(env.SPOTIFY_CLIENT_ID||'').trim();
  const clientSecret=String(env.SPOTIFY_CLIENT_SECRET||'').trim();
  const validId=/^[a-f0-9]{32}$/i.test(clientId);
  return {clientId,clientSecret,ready:validId&&Boolean(clientSecret),
    status:!clientId&&!clientSecret?'brak konfiguracji':!validId?'nieprawidłowy SPOTIFY_CLIENT_ID':
      !clientSecret?'brak SPOTIFY_CLIENT_SECRET':'skonfigurowany'};
}
function trackId(input){
  const value=String(input||'').trim();
  if(/^[a-zA-Z0-9]{22}$/.test(value))return value;
  let url;
  try{url=new URL(value);}catch{throw Error('Podaj link do pojedynczego utworu Spotify.');}
  if(url.protocol!=='https:'||url.hostname!=='open.spotify.com')
    throw Error('Dozwolony jest wyłącznie link do utworu z open.spotify.com.');
  const match=url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]{22})\/?$/);
  if(!match)throw Error('Niepoprawny link do pojedynczego utworu Spotify.');
  return match[1];
}
function clearCache(){cached=null;}
async function accessToken(fetchImpl=fetch,env=process.env){
  const cfg=config(env);
  if(!cfg.ready)throw Error('Spotify API: '+cfg.status+'. Ustaw SPOTIFY_CLIENT_ID i SPOTIFY_CLIENT_SECRET w .env.');
  const key=[cfg.clientId,cfg.clientSecret].join('\0');
  if(cached&&cached.key===key&&cached.expiry>Date.now())return cached.token;
  const res=await fetchImpl(TOKEN_URL,{method:'POST',
    headers:{Authorization:'Basic '+Buffer.from(cfg.clientId+':'+cfg.clientSecret).toString('base64'),
      'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'client_credentials'}),signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error('Spotify API: autoryzacja HTTP '+res.status+'. Sprawdź Client ID, Client Secret i ograniczenia Dev Mode.');
  const json=await res.json();
  if(!json||typeof json.access_token!=='string'||!json.access_token)throw Error('Spotify nie zwróciło tokenu.');
  const seconds=Number(json.expires_in);
  cached={key,token:json.access_token,expiry:Date.now()+(Number.isFinite(seconds)?Math.max(60,seconds-60):3000)*1000};
  return cached.token;
}
async function getTrack(input,fetchImpl=fetch,env=process.env){
  const id=trackId(input),token=await accessToken(fetchImpl,env);
  const res=await fetchImpl(API_URL+encodeURIComponent(id),{
    headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error('Spotify Web API: HTTP '+res.status+'. Sprawdź dostępność track endpointu i tryb Development Mode.');
  const json=await res.json();
  const title=String(json?.name||'').trim().slice(0,130);
  const artist=Array.isArray(json?.artists)?json.artists.map(a=>String(a?.name||'').trim()).filter(Boolean).join(', ').slice(0,130):'';
  if(!title||!artist)throw Error('Spotify API zwróciło niepełne metadane.');
  return {id,title,artist,durationMs:Number(json.duration_ms)||0,url:'https://open.spotify.com/track/'+id};
}
module.exports={config,trackId,clearCache,accessToken,getTrack};
