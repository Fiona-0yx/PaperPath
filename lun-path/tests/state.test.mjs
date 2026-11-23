import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, validate, importState } from '../src/state.js';
test('portable journal retains responses, notes and evidence',()=>{
  const state=blankState();state.profile.goal='A project';state.notes.paper='My own note';state.evidence.push({paperId:'paper',status:'reflection',label:{zh:'理解',en:'Understanding'}});state.completed.push('paper');
  const imported=importState(JSON.stringify(state));assert.equal(imported.notes.paper,'My own note');assert.deepEqual(imported.evidence,state.evidence);assert.deepEqual(imported.completed,['paper']);
});
test('invalid nested state is rejected before replacing a journal',()=>{
  assert.equal(validate({...blankState(),bookmarks:{}}),false);
  assert.equal(validate({...blankState(),notes:['bad']}),false);
  assert.equal(validate({...blankState(),chat:{paper:[{question:'x',reply:4}]}}),false);
  assert.throws(()=>importState('{"version":1,"language":"zh"}'));
});
test('new journals do not share mutable notes or evidence',()=>{
  const first=blankState(),second=blankState();first.notes.a='note';first.evidence.push({paperId:'a',status:'correct'});assert.deepEqual(second.notes,{});assert.deepEqual(second.evidence,[]);
});
