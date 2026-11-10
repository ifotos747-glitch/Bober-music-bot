'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sources = require('../src/sources');
const json = data => ({ok:true,json:async()=>data});
const example = {
  id:'D7KyD', title:'Example Track', user:{ name:'Example Artist' },
  is_streamable:true, permalink:'/example-artist/example-track'
};
function mockAudiusJamendo(body, { jamendo = false } = {}) {
  return async url => {
    if (url.includes('audius.co')) return json({data:body});
    if (jamendo && url.includes('jamendo.com')) return json({results:[]});
    throw new Error('wrong endpoint');
  };
}
test('Audius: dokładny tytuł i autor są wymagane',()=>{
  const parsed=sources.audiusTrack(example);
  assert.equal(parsed.kind,'stream');
  assert.equal(parsed.provider,'Audius');
  assert.equal(sources.exactMatch(parsed,'Example Track','Example Artist'), true);
  assert.equal(sources.exactMatch(parsed,'Example Track','Inny Artysta'), false);
  assert.equal(sources.exactMatch(parsed,'Remix Example Track','Example Artist'), false);
});
test('Audius: utwór z wyłączonym streamingiem nie jest odtwarzany',()=>{
  assert.equal(sources.audiusTrack({...example,is_streamable:false}),null);
  assert.equal(sources.audiusTrack({...example,is_premium:true}),null);
  assert.equal(sources.audiusTrack({...example,id:'../../bad'}),null);
});
test('Jamendo: wymagane HTTPS i licencja CC',()=>{
  const track = { id:'12345', name:'Example Track', artist_name:'Example Artist',
    audio:'https://usercontent.jamendo.com/stream/123.mp3',
    license_ccurl:'https://creativecommons.org/licenses/by/4.0/' };
  assert.equal(sources.jamendoTrack(track).kind,'stream');
  assert.equal(sources.jamendoTrack({...track,license_ccurl:''}),null);
  assert.equal(sources.jamendoTrack({...track,audio:'http://localhost/a.mp3'}),null);
});
test('wyszukiwarka korzysta z publicznego API i filtruje niedostępne nagrania',async()=>{
  delete process.env.JAMENDO_CLIENT_ID;
  const {results,errors}=await sources.searchCatalog('Example Artist Example Track',mockAudiusJamendo([example,{...example,id:'u123',is_streamable:false}]));
  assert.equal(results.length,1); assert.equal(errors.length,0);
  assert.match(results[0].source,/api\.audius\.co/);
});
test('nie wybiera automatycznie, gdy tytuł i wykonawca są niezgodne',async()=>{
  const result=await sources.strictSource('Example Track','Other Artist',mockAudiusJamendo([example]));
  assert.equal(result,null);
});
test('nie wybiera automatycznie, gdy jest kilka identycznych dopasowań',async()=>{
  const result=await sources.strictSource('Example Track','Example Artist',mockAudiusJamendo([example,{...example,id:'p999'}]));
  assert.equal(result,null);
});
test('pozwala wybrać po numerze bez odtwarzania przypadkowego utworu',()=>{
  const t=sources.audiusTrack(example);
  const shown=sources.saveResults('123','456',[t]);
  assert.equal(shown.length,1);
  assert.equal(sources.selectResult('123','456',1).kind,'stream');
  assert.throws(()=>sources.selectResult('123','456',2));
  assert.throws(()=>sources.selectResult('123','different',1));
});
test('odrzuca prywatne IP w adresie źródłowym',()=>{
  assert.equal(sources.publicHttp('http://127.0.0.1:8000/file'),null);
  assert.equal(sources.publicHttp('https://192.168.1.1/media'),null);
  assert.equal(sources.publicHttp('https://cdn.example.com/audio.mp3'),'https://cdn.example.com/audio.mp3');
});
test('rozpoznaje format wykonawca - tytuł',()=>{
  assert.deepEqual(sources.queryParts('DJ Test - Nowa piosenka'),{artist:'DJ Test',title:'Nowa piosenka'});
});

test('3.0: po braku dokładnego dopasowania próbuje tytułu i wciąż weryfikuje wykonawcę', async () => {
  delete process.env.JAMENDO_CLIENT_ID;
  const calls=[];
  const fetchMock=async url=>{
    const q=new URL(url).searchParams.get('query');
    calls.push(q);
    if (q==='Example Artist Example Track') return json({data:[]});
    if (q==='Example Track') return json({data:[example]});
    return json({data:[]});
  };
  const song=await sources.strictSource('Example Track','Example Artist',fetchMock);
  assert.equal(song?.provider,'Audius');
  assert.deepEqual(calls,['Example Artist Example Track','Example Track']);
});

test('3.0: nie wybiera przypadkowego wykonawcy z wyników drugiego wyszukiwania', async () => {
  delete process.env.JAMENDO_CLIENT_ID;
  const fetchMock=async url=>json({data:new URL(url).searchParams.get('query') === 'Example Track' ? [example] : []});
  assert.equal(await sources.strictSource('Example Track','Nieznany Wykonawca',fetchMock),null);
});

test('3.0: status usług rozróżnia działające, niedostępne i wyłączone katalogi', async () => {
  delete process.env.JAMENDO_CLIENT_ID;
  const earlier=process.env.AUDIUS_ENABLED;
  process.env.AUDIUS_ENABLED='1';
  try {
    const online=await sources.checkProviders(async url=>json({data:[example]}));
    assert.deepEqual(online.map(x=>x.status),['ok','disabled']);
    const offline=await sources.checkProviders(async url=>{throw Error('API nie odpowiada');});
    assert.deepEqual(offline.map(x=>x.status),['error','disabled']);
  } finally {
    if(earlier===undefined) delete process.env.AUDIUS_ENABLED;
    else process.env.AUDIUS_ENABLED=earlier;
  }
});
