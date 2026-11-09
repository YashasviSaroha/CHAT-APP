import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationKey,
  expiresAtFrom,
  isBlocked,
  mentionHandles,
  publicUser,
  qrState,
  retentionHours,
  usernameError,
  withinWindow,
} from "../lib/policy.js";

test("conversation keys are stable for both orders", () => {
  assert.equal(conversationKey("b", "a"), conversationKey("a", "b"));
  assert.equal(conversationKey("b", "a"), "a_b");
});

test("retention is limited to the supported periods", () => {
  assert.equal(retentionHours(12), 12);
  assert.equal(retentionHours(168), 168);
  assert.equal(retentionHours(3), 24);
});

test("expiry is measured from the creation time", () => {
  const created = new Date("2026-11-09T00:00:00.000Z");
  const expires = expiresAtFrom(created, 12);
  assert.equal(expires.toISOString(), "2026-11-09T12:00:00.000Z");
});

test("edit and delete windows close after their limit", () => {
  const created = new Date(Date.now() - 20 * 60 * 1000);
  assert.equal(withinWindow(created, 15 * 60 * 1000), false);
  assert.equal(withinWindow(created, 60 * 60 * 1000), true);
});

test("usernames accept letters, numbers, and underscores", () => {
  assert.equal(usernameError("ada_1"), "");
  assert.equal(usernameError("A"), "Username must be 3-20 characters: letters, numbers, or underscore.");
});

test("mentions read handles without taking the email", () => {
  assert.deepEqual(mentionHandles("Hello @Ada_1 and a@b.com"), ["ada_1"]);
});

test("either side of a block stops messaging", () => {
  assert.equal(isBlocked(["b"], [], "a", "b"), true);
  assert.equal(isBlocked([], ["a"], "a", "b"), true);
  assert.equal(isBlocked([], [], "a", "b"), false);
});

test("public profiles do not include the password hash", () => {
  const user = publicUser({ fullName: "Ada", password: "hashed", email: "ada@example.com" });
  assert.equal(user.password, undefined);
  assert.equal(user.fullName, "Ada");
});

test("QR codes expire, and a used or revoked code cannot be reused", () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);
  assert.equal(qrState({ expires_at: future }), "active");
  assert.equal(qrState({ expires_at: past }), "expired");
  assert.equal(qrState({ expires_at: future, redeemed_at: new Date() }), "used");
  assert.equal(qrState({ expires_at: future, revoked_at: new Date() }), "revoked");
  assert.equal(qrState(null), "missing");
});
