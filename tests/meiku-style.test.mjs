import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync('src/city/city.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');
test('shared city button defaults exclude the embedded pet app without increasing selector specificity',()=>{
 const selectors=[...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(m=>m[1].split(',')).map(s=>s.trim()).filter(s=>s.startsWith('.city-main button'));
 assert.equal(selectors.length,3,'Check normal, disabled and focus states');
 for(const selector of selectors)assert.match(selector,/^\.city-main button:where\(:not\(\.meiku-module \.app button\)\)(?::disabled|:focus-visible)?$/);
});
