#!/usr/bin/env node
/* 말씀공방 — 단일 실행 파일 빌드
 * index.html + style.css + prompts.js + app.js → 말씀공방_앱.html (더블클릭 실행)
 * 사용: node 말씀공방/build.cjs
 */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let html = read('index.html');
const css = read('style.css');
const prompts = read('prompts.js');
const app = read('app.js');

// 인라인 스크립트 안전성 검사
for (const [name, code] of [['prompts.js', prompts], ['app.js', app]]) {
  if (/<\/script/i.test(code)) throw new Error(name + ' 안에 </script> 문자열이 있어 인라인할 수 없습니다.');
}

// 주의: 치환 문자열의 $ 패턴($&, $` 등) 해석을 막기 위해 반드시 함수 치환을 쓴다
html = html.replace(/<link rel="stylesheet" href="style\.css(?:\?[^"]*)?">/, () => '<style>\n' + css + '\n</style>');
html = html.replace(/<script src="prompts\.js(?:\?[^"]*)?"><\/script>/, () => '<script>\n' + prompts + '\n</script>');
html = html.replace(/<script src="app\.js(?:\?[^"]*)?"><\/script>/, () => '<script>\n' + app + '\n</script>');
html = html.replace('<title>말씀공방 — 들리는 설교, 끌리는 설교</title>',
  '<title>말씀공방 — 들리는 설교, 끌리는 설교</title>\n<!-- 단일 실행 파일 빌드: ' + new Date().toISOString().slice(0, 10) + ' · 원본 소스는 말씀공방/ 폴더 -->');

const out = path.join(ROOT, '말씀공방_앱.html');
fs.writeFileSync(out, html);
console.log('생성 완료:', out, '(' + Math.round(html.length / 1024) + 'KB)');
