'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const oauth=require('../src/youtube-oauth'),spotify=require('../src/spotify-api');
const google={YOUTUBE_OAUTH_CLIENT_ID:'123456789012-abcd.apps.googleusercontent.com',
  YOUTUBE_OAUTH_CLIENT_SECRET:'test-only',YOUTUBE_OAUTH_REFRESH_TOKEN:'test-refresh'};
const creds={SPOTIFY_CLIENT_ID:'a'.repeat(32),SPOTIFY_CLIENT_SECRET:'test-only'};
test('YouTube: bez OAuth brak dostępu do konta',()=>assert.equal(oauth.config({}).ready,false));
test('YouTube: samo Client ID nie wystarcza',()=>assert.equal(oauth.config({YOUTUBE_OAUTH_CLIENT_ID:google.YOUTUBE_OAUTH_CLIENT_ID}).ready,false));
test('YouTube: token odświeżany przez POST',async()=>{
  oauth.clearCache();let count=0;
  const fn=async(url,opts)=>{count++;assert.match(url,/oauth2\.googleapis/);assert.equal(opts.method,'POST');
    return {ok:true,json:async()=>({access_token:'test-access',expires_in:3600})};};
  await oauth.accessToken(fn,google);await oauth.accessToken(fn,google);assert.equal(count,1);
});
test('YouTube: dane konta i lista playlist',async()=>{
  oauth.clearCache();
  const fn=async(url,opts)=>{
    if(url.includes('oauth2'))return {ok:true,json:async()=>({access_token:'test',expires_in:3600})};
    assert.equal(opts.headers.Authorization,'Bearer test');
    return url.includes('/channels?') ? {ok:true,json:async()=>({items:[{id:'UC123',snippet:{title:'My Channel'}}]})} :
      {ok:true,json:async()=>({items:[{id:'PL123',snippet:{title:'My Playlist'},contentDetails:{itemCount:10}}]})};
  };
  assert.equal((await oauth.account(fn,google)).title,'My Channel');
  assert.equal((await oauth.playlists(fn,google))[0].count,10);
});
test('Spotify: brak Secret = konfiguracja niepełna',()=>assert.equal(spotify.config({SPOTIFY_CLIENT_ID:'a'.repeat(32)}).ready,false));
test('Spotify: link utworu i blokada obcych domen',()=>{
  assert.equal(spotify.trackId('https://open.spotify.com/track/7MkbOrtTIUzlcek3uE0th9?si=1'),'7MkbOrtTIUzlcek3uE0th9');
  assert.throws(()=>spotify.trackId('https://evil.example/track/7MkbOrtTIUzlcek3uE0th9'));
});
test('Spotify: Client Credentials i metadane',async()=>{
  spotify.clearCache();
  const fn=async(url,opts)=>url.includes('accounts.spotify.com')?
    {ok:true,json:async()=>({access_token:'testSpotify',expires_in:3600})} :
    (assert.equal(opts.headers.Authorization,'Bearer testSpotify'),
    {ok:true,json:async()=>({name:'Test title',artists:[{name:'Test artist'}]})});
  const r=await spotify.getTrack('7MkbOrtTIUzlcek3uE0th9',fn,creds);
  assert.equal(r.title,'Test title');assert.equal(r.artist,'Test artist');
});
test('Spotify: błąd HTTP nie ujawnia Client Secret',async()=>{
  spotify.clearCache();
  const fn=async()=>({ok:false,status:403});
  await assert.rejects(()=>spotify.getTrack('7MkbOrtTIUzlcek3uE0th9',fn,creds),
    e=>e.message.includes('403')&&!e.message.includes(creds.SPOTIFY_CLIENT_SECRET));
});
