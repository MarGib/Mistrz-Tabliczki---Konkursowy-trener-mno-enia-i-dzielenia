import assert from 'node:assert/strict';
import test from 'node:test';
import { helpSuggestions, norm, searchHelp } from './helpSearch';

test('wyszukiwarka pomocy: polskie znaki, początki słów, synonimy, podpowiedzi', () => {
  assert.equal(norm('Nie pamiętam HASŁA!'), 'nie pamietam hasla');
  assert.equal(searchHelp('nie pamiętam hasła')[0].section.id, 'forgot');
  assert.equal(searchHelp('haslo')[0].section.id, 'forgot');
  assert.equal(searchHelp('has')[0].section.id, 'forgot');
  assert.equal(searchHelp('PIN')[0].section.id, 'forgot');
  assert.equal(searchHelp('internet')[0].section.id, 'offline');
  assert.equal(searchHelp('kod grupy')[0].section.id, 'group-join');
  assert.equal(searchHelp('usuń konto')[0].section.id, 'privacy');
  assert.equal(searchHelp('dyplom')[0].section.id, 'certificates');
  assert.deepEqual(searchHelp('zzzqqq'), []);
  assert.equal(helpSuggestions('hasł')[0].label, 'Nie pamiętam hasła');
  assert.ok(helpSuggestions('').length >= 5);
});
