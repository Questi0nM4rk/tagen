#!/usr/bin/env bun
import { fail, pass, readPayload } from "../../../../../../src/validator-runtime.ts";

const payload = await readPayload<{ body?: string }>();
const body = payload.body ?? "";
const hits: string[] = [];
const emojiRe = /\p{Emoji_Presentation}/u;
if (emojiRe.test(body)) hits.push("emoji present in review body");
if (hits.length > 0) fail(hits);
pass();
