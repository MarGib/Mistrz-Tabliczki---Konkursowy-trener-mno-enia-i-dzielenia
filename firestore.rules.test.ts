import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesSource = fs.readFileSync('firestore.rules', 'utf8');

test('firestore.rules includes default-deny safety net and verified-user gates', () => {
  assert.ok(rulesSource.includes("rules_version = '2';"));
  assert.ok(rulesSource.includes('allow read, write: if false;'));
  assert.ok(rulesSource.includes('request.auth.token.email_verified == true'));
});

test('firestore.rules enforces all collections from firebase-blueprint.json with no blanket list reads', () => {
  const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));
  const collectionPaths = Object.keys(blueprint.firestore);
  assert.equal(collectionPaths.length, 7);

  // Every collection denies list enumeration
  const listFalseMatches = rulesSource.match(/allow list:\s*if false;/g) ?? [];
  assert.equal(listFalseMatches.length, 7);

  // Required security invariants from Dirty Dozen spec
  assert.ok(rulesSource.includes('isValidId('));
  assert.ok(rulesSource.includes('isGroupMember('));
  assert.ok(rulesSource.includes('isValidSchoolDirectory('));
  assert.ok(rulesSource.includes('affectedKeys().hasOnly('));
  assert.ok(rulesSource.includes('incoming().updatedAt == request.time'));
  assert.ok(rulesSource.includes('incoming().ownerUid == existing().ownerUid'));
  assert.ok(rulesSource.includes('data.xp >= 0'));
  assert.ok(rulesSource.includes('data.sessions.size() <= 40'));
  assert.ok(rulesSource.includes('schoolName'));
  assert.ok(rulesSource.includes('className'));
});
