'use client';

import React, { useState, useEffect } from 'react';

// ==========================================
// 英語喉 辞書・マッピングデータ
// ==========================================
const phonemeToNodo: Record<string, string> = {
  'AA': 'A', 'AE': 'a̲', 'AH': 'u̲', 'AO': 'A', 'AW': 'a̲U',
  'AY': 'AI', 'EH': 'E̲̅', 'ER': 'E̲r̲', 'EY': 'eI', 'IH': 'i̲',
  'IY': 'I', 'OW': 'O', 'OY': 'OI', 'UH': 'u', 'UW': 'U',
  'P': 'P', 'B': 'B', 'T': 'T', 'D': 'D̲', 'K': 'K', 'G': 'G',
  'F': 'F', 'V': 'v', 'TH': 'th', 'DH': 'th', 'S': 'S', 'Z': 'Z',
  'SH': 'SH', 'ZH': 'ZH', 'CH': 'CH', 'JH': 'J', 'HH': 'H',
  'M': 'M', 'N': 'N', 'NG': 'NG', 'L': 'l', 'R': 'r̲', 'Y': 'Y̲', 'W': 'W̲'
};

const voicelessConsonants = ['P', 'T', 'K', 'F', 'th', 'S', 'SH', 'CH', 'H'];

const customDict: Record<string, string[]> = {
  'how': ['H', 'aU', 'W'], 'do': ['D̲', 'U', '#'], 'you': ['Y̲', 'U', '#'], 'like': ['l', 'AI', 'K'],
  'japanese': ['J', 'a̲', 'P', '#', 'i̲', 'N', '#', 'I', 'Z'],
  
  'another': ['#', 'u̲', 'N', 'N', 'u̲', 'D̲', 'D̲', 'E̲r̲', '#'], 
  'looking': ['l', 'u', 'K', 'K', 'i̲', 'N'], 
  'dots': ['D̲', 'A', 'TS'], 
  'can': ['K', 'u̲', 'N'], 
  'cant': ['K', 'a̲', 'NT'], 
  'ridin': ['r̲', 'AI', 'D̲', 'D̲', 'i̲', 'N'], 
  'riding': ['r̲', 'AI', 'D̲', 'D̲', 'i̲', 'N'],
  'fences': ['F', 'E̲̅', 'N', 'S', 'i̲', 'Z'], 
  'senses': ['S', 'E̲̅', 'N', 'S', 'i̲', 'Z'], 
  'pleasin': ['Pl', 'I', 'Z', 'Z', 'i̲', 'N'],
  'reasons': ['r̲', 'I', 'Z', 'Z', 'u̲', 'NZ'], 
  'desperado': ['D̲', 'E̲̅', 'S', 'P', 'E̲r̲', '#', 'r̲', 'A', '#', 'D̲', 'O', '#'], 
  'hard': ['H', 'A', 'r̲D̲'], 
  'one': ['W', 'u̲', 'N'], 
  'got': ['G', 'A', 'T'], 'your': ['Y̲', 'E̲r̲', '#'], 
  'these': ['th', 'I', 'Z'], 'things': ['th', 'i̲', 'NGZ'], 
  'hurt': ['H', 'E̲r̲', 'T'], 'somehow': ['S', 'u̲', 'M', 'H', 'aU', '#'],
  
  'gotchur': ['G', 'A', 'CH', 'CH', 'E̲r̲', '#'], 
  'gotcha': ['G', 'A', 'CH', 'CH', 'u̲', '#'],  
  'hurchu': ['H', 'E̲r̲', 'CH', 'CH', 'U', '#'], 
  'whatchur': ['W', 'u̲', 'CH', 'CH', 'E̲r̲', '#'], 
  'catcha': ['K', 'a̲', 'CH', 'CH', 'u̲', '#'],  
  'dontchu': ['D̲', 'O', 'N', 'CH', 'U', '#'], 
  'whydontchu': ['W', 'AI', '#', 'D̲', 'O', 'N', 'CH', 'U', '#'], 

  'gonna': ['G', 'u̲', 'N', 'N', 'u̲', '#'], 'wanna': ['W', 'A', 'N', 'N', 'u̲', '#'],
  'gotta': ['G', 'A', 'D̲', 'D̲', 'u̲', '#'], 'kinda': ['K', 'AI', 'N', 'D̲', 'u̲', '#'],
  'outta': ['#', 'a̲U', 'D̲', 'D̲', 'u̲', '#'], 'lemme': ['l', 'E̲̅', 'M', 'M', 'I', '#'],
  'gimme': ['G', 'i̲', 'M', 'M', 'I', '#'], 'hafta': ['H', 'a̲', 'F', 'T', 'u̲', '#'],
  'hasta': ['H', 'a̲', 'S', 'T', 'u̲', '#'], 'dunno': ['D̲', 'u̲', 'N', 'N', 'O', '#'],
  'seeng': ['S', 'I', 'N'], 'doin': ['D̲', 'U', 'N'], 'goin': ['G', 'O', 'N'],
  'evry': ['#', 'E̲̅', 'v', 'r̲', 'I', '#'], 'camra': ['K', 'a̲', 'M', 'r̲', 'u̲', '#'], 
  'famly': ['F', 'a̲', 'M', 'l', 'I', '#'], 'choclate': ['CH', 'A', 'K', 'l', 'i̲', 'T'], 
  'exacly': ['#', 'i̲', 'G', 'Z', 'a̲', 'K', 'l', 'I', '#'], 'mosly': ['M', 'O', 'S', 'l', 'I', '#'],

  'withoutchu': ['W', 'i̲', 'th', 'th', 'aU', 'CH', 'CH', 'U', '#'], 
  'allaboudit': ['#', 'A', 'l', 'l', 'u̲', 'B', 'B', 'aU', 'D̲', 'D̲', 'i̲', 'T'],
  'wheni': ['W', 'E̲̅', 'N', 'N', 'AI', '#'], 'tellyu': ['T', 'E̲̅', 'l', 'lY̲', 'U', '#'], 
  'wevcoma': ['W', 'I', 'v', 'K', 'u̲', 'M', 'M', 'u̲', '#'],
  'fromwherewe': ['Fr̲', 'u̲', 'M', 'W', 'E̲r̲', '#', 'W', 'I', '#'], 'allthe': ['#', 'A', 'l', 'D̲', 'u̲', '#'],
  'wevbeenthrough': ['W', 'I', 'v', 'B', 'i̲', 'N', 'thr̲', 'U', '#'],
  'thatillbe': ['D̲', 'a̲', 'D̲', 'D̲', 'AI', 'l', 'B', 'I', '#'], 
  'standinrighthere': ['ST', 'a̲', 'N', 'D̲', 'i̲', 'N', 'r̲', 'AI', 'D̲', 'H', 'I', 'r̲'],
  'talkintoyou': ['T', 'A', 'K', 'K', 'i̲', 'N', 'T', 'u', '#', 'Y̲', 'U', '#'], 
  'aboudanother': ['#', 'u̲', 'B', 'B', 'aU', 'D̲', 'D̲', 'u̲', 'N', 'N', 'u̲', 'D̲', 'D̲', 'E̲r̲', '#'],
  'hittheroad': ['H', 'i̲', 'D̲', 'D̲', 'u̲', '#', 'r̲', 'O', 'D̲'], 'butsomethin': ['B', 'u̲', 'T', 'S', 'u̲', 'M', 'th', 'i̲', 'N'],
  'thatitwouldnt': ['D̲', 'a̲', 'D̲', 'D̲', 'i̲', 'D̲', 'W̲', 'u', 'D̲', 'D̲', 'u̲', 'N'], 
  'lookatthings': ['l', 'u', 'K', 'K', 'a̲', 'T', 'th', 'i̲', 'NGZ'],
  'seethe': ['S', 'I', '#', 'D̲', 'u̲', '#'], 'thosewerethe': ['D̲', 'O', 'Z', 'W', 'E̲r̲', '#', 'D̲', 'u̲', '#'],
  'howcouldwenot': ['H', 'aU', '#', 'K', 'u', 'D̲', 'W', 'I', '#', 'N', 'A', 'T'], 'talkabout': ['T', 'A', 'K', 'K', 'u̲', 'B', 'B', 'aU', 'T'],
  'allthatwegot': ['#', 'A', 'l', 'D̲', 'a̲', 'D̲', 'W', 'I', '#', 'G', 'A', 'T'], 
  'everythingi': ['#', 'E̲̅', 'v', 'r̲', 'I', '#', 'th', 'i̲', 'NG', 'G', 'AI', '#'],
  'wentthrough': ['W', 'E̲̅', 'N', 'thr̲', 'U', '#'], 'bymyside': ['B', 'AI', '#', 'M', 'AI', '#', 'S', 'AI', 'D̲'], 
  'andnowyou': ['#', 'a̲', 'N', 'N', 'aU', '#', 'Y̲', 'U', '#'],
  'iminlove': ['#', 'AI', 'M', 'M', 'i̲', 'N', 'l', 'u̲', 'v'], 'shapeofyou': ['SH', 'eI', 'P', 'P', 'O', 'v', 'Y̲', 'U', '#'],
  'pushand': ['P', 'u', 'SH', 'SH', 'E̲̅', 'N'], 'magnetdo': ['M', 'a̲', 'G', 'N', 'i̲', 'D̲', 'D̲', 'U', '#'],
  'lastnightyou': ['l', 'a̲', 'S', 'N', 'AI', 'CH', 'CH', 'U', '#'], 'smelllikeyou': ['SM', 'E̲̅', 'l', 'l', 'AI', 'K', 'Y̲', 'U', '#'],
  'everyday': ['#', 'E̲̅', 'v', 'r̲', 'I', '#', 'D̲', 'eI', '#'], 'discoverin': ['D̲', 'i̲', 'S', 'K', 'u̲', 'v', 'v', 'E̲r̲', '#', 'r̲', 'i̲', 'N'],
  'somethin': ['S', 'u̲', 'M', 'th', 'i̲', 'N'], 'brandnew': ['Br̲', 'a̲', 'N', 'N', 'U', '#'], 
  'wantyour': ['W', 'A', 'N', 'CH', 'E̲r̲', '#'], 'whatwere': ['W', 'A', 'W', 'W', 'I', 'r̲'],
  'livingin': ['l', 'i̲', 'v', 'v', 'i̲', 'N', 'N', 'I', 'N'], 'letmetellya': ['l', 'E̲̅', 'M', 'M', 'I', '#', 'T', 'E̲̅', 'l', 'l', 'u̲', '#'],
  'madeof': ['M', 'eI', 'D̲', 'D̲', 'u̲', 'v'], 'virtualinsanity': ['v', 'E̲r̲', '#', 'CH', 'u', 'l', 'l', 'i̲', 'N', 'S', 'a̲', 'N', 'N', 'i̲', 'D̲', 'D̲', 'I', '#'],
  'worldssmallest': ['W', 'E̲r̲', 'Z', 'SM', 'A', 'l', '#', 'i̲', 'S'], 'needsan': ['N', 'I', 'D̲Z', '#', 'u̲', 'N'],
  'blowupinto': ['Bl', 'O', '#', '#', 'u̲', 'P', 'P', 'i̲', 'N', 'T', 'U', '#'], 'thatssuchashame': ['D̲', 'a̲', 'TS', 'S', 'u̲', 'CH', 'CH', 'u̲', '#', 'SH', 'eI', 'M'],
  'loseyourself': ['l', 'U', 'Z', 'Y̲', 'E̲r̲', '#', 'S', 'E̲̅', 'lF'], 'oneopportunity': ['W', 'u̲', 'N', 'N', 'A', 'P', 'P', 'E̲r̲', '#', 'T', 'U', 'N', 'N', 'i̲', 'D̲', 'D̲', 'I', '#'],
  'palmsare': ['P', 'A', 'MZ', '#', 'E̲r̲', '#'], 'momsspaghetti': ['M', 'A', 'MZ', 'SP', 'u̲', '#', 'G', 'E̲̅', 'D̲', 'D̲', 'I', '#'],
  'theregoes': ['D̲', 'E̲r̲', '#', 'G', 'O', 'Z']
};

const superNativeRules = [
  { pattern: /\bgot your\b/gi, replacement: "gotchur" },
  { pattern: /\bgot you\b/gi, replacement: "gotcha" },
  { pattern: /\bhurt you\b/gi, replacement: "hurchu" },
  { pattern: /\bwhat your\b/gi, replacement: "whatchur" },
  { pattern: /\bcatch you\b/gi, replacement: "catcha" },
  { pattern: /\bdon't you\b/gi, replacement: "dontchu" }, 
  { pattern: /\bwhy don't you\b/gi, replacement: "whydontchu" }, 

  { pattern: /\bwithout you\b/gi, replacement: "withoutchu" }, { pattern: /\ball about it\b/gi, replacement: "allaboudit" },
  { pattern: /\bwhen i\b/gi, replacement: "wheni" }, { pattern: /\btell you\b/gi, replacement: "tellyu" },
  { pattern: /\bwe've come a\b/gi, replacement: "wevcoma" }, { pattern: /\bfrom where we\b/gi, replacement: "fromwherewe" },
  { pattern: /\ball the\b/gi, replacement: "allthe" }, { pattern: /\bwe've been through\b/gi, replacement: "wevbeenthrough" },
  { pattern: /\bthat i'll be\b/gi, replacement: "thatillbe" }, { pattern: /\bstanding right here\b/gi, replacement: "standinrighthere" }, 
  { pattern: /\btalking to you\b/gi, replacement: "talkintoyou" }, { pattern: /\babout another\b/gi, replacement: "aboudanother" }, 
  { pattern: /\bhit the road\b/gi, replacement: "hittheroad" }, { pattern: /\bbut something\b/gi, replacement: "butsomethin" }, 
  { pattern: /\bthat it wouldn't\b/gi, replacement: "thatitwouldnt" }, { pattern: /\blook at things\b/gi, replacement: "lookatthings" }, 
  { pattern: /\bsee the\b/gi, replacement: "seethe" }, { pattern: /\bthose were the\b/gi, replacement: "thosewerethe" }, 
  { pattern: /\bhow could we not\b/gi, replacement: "howcouldwenot" }, { pattern: /\btalk about\b/gi, replacement: "talkabout" }, 
  { pattern: /\ball that we got\b/gi, replacement: "allthatwegot" }, { pattern: /\beverything i\b/gi, replacement: "everythingi" }, 
  { pattern: /\bwent through\b/gi, replacement: "wentthrough" }, { pattern: /\bby my side\b/gi, replacement: "bymyside" }, 
  { pattern: /\band now you\b/gi, replacement: "andnowyou" }, { pattern: /\bi'm in love with\b/gi, replacement: "iminlove" }, 
  { pattern: /\bshape of you\b/gi, replacement: "shapeofyou" }, { pattern: /\bpush and\b/gi, replacement: "pushand" }, 
  { pattern: /\bmagnet do\b/gi, replacement: "magnetdo" }, { pattern: /\blast night you\b/gi, replacement: "lastnightyou" }, 
  { pattern: /\bsmell like you\b/gi, replacement: "smelllikeyou" }, { pattern: /\bevery day\b/gi, replacement: "everyday" }, 
  { pattern: /\bdiscovering\b/gi, replacement: "discoverin" }, { pattern: /\bsomething\b/gi, replacement: "somethin" }, 
  { pattern: /\bbrand new\b/gi, replacement: "brandnew" }, { pattern: /\bwant your\b/gi, replacement: "wantyour" }, 
  { pattern: /\bwhat we're\b/gi, replacement: "whatwere" }, { pattern: /\bliving in\b/gi, replacement: "livingin" },
  { pattern: /\blet me tell ya\b/gi, replacement: "letmetellya" }, { pattern: /\bmade of\b/gi, replacement: "madeof" },
  { pattern: /\bvirtual insanity\b/gi, replacement: "virtualinsanity" }, { pattern: /\bworld's smallest\b/gi, replacement: "worldssmallest" }, 
  { pattern: /\bneeds an\b/gi, replacement: "needsan" }, { pattern: /\bblow up into\b/gi, replacement: "blowupinto" }, 
  { pattern: /\bthat's such a shame\b/gi, replacement: "thatssuchashame" }, { pattern: /\blose yourself\b/gi, replacement: "loseyourself" }, 
  { pattern: /\bone opportunity\b/gi, replacement: "oneopportunity" }, { pattern: /\bpalms are\b/gi, replacement: "palmsare" }, 
  { pattern: /\bmom's spaghetti\b/gi, replacement: "momsspaghetti" }, { pattern: /\bthere goes\b/gi, replacement: "theregoes" }, 
  
  { pattern: /\bi am going to\b/gi, replacement: "imma" }, { pattern: /\bwhat do you want to\b/gi, replacement: "whatcha wanna" }, 
  { pattern: /\bi don't know\b/gi, replacement: "i dunno" }, { pattern: /\bwhat do you\b/gi, replacement: "whatcha" }, 
  { pattern: /\bdid you\b/gi, replacement: "didja" }, { pattern: /\bwould you\b/gi, replacement: "wouldja" }, 
  { pattern: /\bshould have\b/gi, replacement: "shoulda" }, { pattern: /\ba lot of\b/gi, replacement: "alotta" }, 
  { pattern: /\bin the\b/gi, replacement: "inna" }, { pattern: /\bgoing to\b/gi, replacement: "gonna" }, 
  { pattern: /\bwant to\b/gi, replacement: "wanna" }, { pattern: /\bgot to\b/gi, replacement: "gotta" }, 
  { pattern: /\bhave to\b/gi, replacement: "hafta" }, { pattern: /\bkind of\b/gi, replacement: "kinda" }, 
  { pattern: /\blet me\b/gi, replacement: "lemme" }, { pattern: /\bseeing\b/gi, replacement: "seeng" }, 
  { pattern: /\bdoing\b/gi, replacement: "doin" }, { pattern: /\bgoing\b/gi, replacement: "goin" }, 
  { pattern: /\bexactly\b/gi, replacement: "exacly" }, { pattern: /\bmostly\b/gi, replacement: "mosly" }
];

const katakanaDict: Record<string, string> = {
  'hard': 'ハード', 'one': 'ワン', 'got': 'ゴット', 'your': 'ユア', 
  'can': 'カン', 'cant': 'キャント', 'hurt': 'ハート', 'somehow': 'サムハウ',
  'reasons': 'リーズンズ', 'these': 'ディーズ', 'things': 'スィングズ', 'pleasin': 'プリージン',
  'another': 'アナダー', 'looking': 'ルッキン', 'dots': 'ドッツ', 'forward': 'フォワード', 
  'gotchur': 'ガッチュア', 'gotcha': 'ガッチャ', 'hurchu': 'ハーチュ', 
  'whatchur': 'ワッチュア', 'catcha': 'キャッチャ', 
  'dontchu': 'ドンチュー', 'whydontchu': 'ワイドンチュー',
  'withoutchu': 'ウィザウチュ', 'allaboudit': 'オラバウティ', 'wheni': 'ウェナイ', 'tellyu': 'テリュ',
  'wevcoma': 'ウィヴカマ', 'fromwherewe': 'フロムウェアウィ', 'allthe': 'オーダ', 
  'wevbeenthrough': 'ウィーヴビーンスルー', 'thatillbe': 'ダライウビー',
  'standinrighthere': 'スタンディンライヒア', 'talkintoyou': 'トーキントゥユー', 'aboudanother': 'アバウトゥアナダー',
  'hittheroad': 'ヒッダロード', 'butsomethin': 'バッサムティン', 'thatitwouldnt': 'ダッイッウドゥン',
  'lookatthings': 'ルッカッティングス', 'seethe': 'スィーダ', 'thosewerethe': 'ドーズワーダ',
  'howcouldwenot': 'ハウクドゥウィーノッ', 'talkabout': 'トーカバウ', 'allthatwegot': 'オーダッウィーガッ',
  'everythingi': 'エヴリティンガイ', 'wentthrough': 'ウェンスルー', 'bymyside': 'バイマイサイ', 'andnowyou': 'アンナウユー',
  'iminlove': 'アィミンラー', 'shapeofyou': 'シェイプォーヴュー', 'pushand': 'プッシェン', 'magnetdo': 'マグネッドゥー',
  'lastnightyou': 'ラスナイチュ', 'smelllikeyou': 'スメルライキュー', 'everyday': 'エヴリデイ', 
  'discoverin': 'ディスカヴァリン', 'somethin': 'サムスィン', 'brandnew': 'ブランニュー', 'wantyour': 'ワンチュア',
  'whatwere': 'ワッウィー', 'livingin': 'リビニーン', 'letmetellya': 'レミテーヤ', 'madeof': 'メイダーブ',
  'virtualinsanity': 'バーチュアリサーダリー', 'worldssmallest': 'ワーズスモーレス', 'needsan': 'ニーザン',
  'blowupinto': 'ブロアッピントゥ', 'thatssuchashame': 'ザッチャシェイム', 'loseyourself': 'ルーズユアセルフ',
  'oneopportunity': 'ワンオポチュニティ', 'palmsare': 'パームスアー', 'momsspaghetti': 'マムズスパゲッティ',
  'theregoes': 'ゼアゴーズ',
  'imma': 'アイマ', 'whatcha': 'ワッチャ', 'dunno': 'ダノゥ', 'didja': 'ディジャ', 'wouldja': 'ウッジャ', 'couldja': 'クッジャ', 
  'shouldja': 'シュッジャ', 'didntcha': 'ディドゥンチャ', 'betcha': 'ベッチャ', 
  'gonna': 'ガナ', 'wanna': 'ワナ', 'gotta': 'ガラ', 'hafta': 'ハフタ', 'hasta': 'ハスタ', 'kinda': 'カインダ', 
  'outta': 'アウダ', 'lemme': 'レミ', 'gimme': 'ギミ', 'cmon': 'カモーン', 'cuz': 'カズ', 'probly': 'プロブリー', 
  'she': 'シー', 'he': 'ヒー', 'we': 'ウィー', 'me': 'ミー', 'be': 'ビー', 'see': 'シー', 'the': 'ザ',
  'people': 'ピープル', 'earth': 'アース', 'moon': 'ムーン', 'has': 'ハズ', 'have': 'ハヴ', 'been': 'ビーン',
  'mystery': 'ミステリー', 'think': 'シンク', 'about': 'アバウト', 'strong': 'ストロング', 'enough': 'イナフ',
  'pull': 'プル', 'oceans': 'オーシャンズ', 'when': 'ウェン', 'dies': 'ダイズ', 'away': 'アウェイ',
  'always': 'オールウェイズ', 'comes': 'カムズ', 'back': 'バック', 'again': 'アゲイン',
  'this': 'ディス', 'that': 'ザット', 'those': 'ゾーズ', 'there': 'ゼア', 'their': 'ゼア',
  'then': 'ゼン', 'they': 'ゼイ', 'a': 'ア', 'an': 'アン', 'as': 'アズ', 'long': 'ロング', 'on': 'オン',
  'it': 'イット', 'is': 'イズ', 'are': 'アー', 'was': 'ワズ', 'were': 'ワー', 'do': 'ドゥ', 'did': 'ディド',
  'could': 'クド', 'will': 'ウィル', 'would': 'ウッ', 'shall': 'シャル', 'should': 'シュド',
  'make': 'メイク', 'made': 'メイド', 'take': 'テイク', 'took': 'トゥック', 'get': 'ゲット',
  'go': 'ゴー', 'went': 'ウェント', 'come': 'カム', 'came': 'ケイム', 'say': 'セイ', 'said': 'セッド',
  'know': 'ノウ', 'knew': 'ニュー', 'look': 'ルック', 'use': 'ユーズ', 'find': 'ファインド', 'found': 'ファウンド',
  'give': 'ギヴ', 'gave': 'ゲイヴ', 'tell': 'テル', 'told': 'トールド', 'work': 'ワーク', 'call': 'コール',
  'try': 'トライ', 'ask': 'アスク', 'need': 'ニード', 'feel': 'フィール', 'become': 'ビカム', 'leave': 'リーヴ',
  'put': 'プット', 'mean': 'ミーン', 'keep': 'キープ', 'let': 'レット', 'begin': 'ビギン', 'seem': 'シーム',
  'help': 'ヘルプ', 'talk': 'トーク', 'turn': 'ターン', 'start': 'スタート', 'show': 'ショウ', 'hear': 'ヒア',
  'play': 'プレイ', 'run': 'ラン', 'move': 'ムーヴ', 'like': 'ライク', 'live': 'リヴ', 'believe': 'ビリーヴ',
  'hold': 'ホールド', 'bring': 'ブリング', 'happen': 'ハプン', 'write': 'ライト', 'provide': 'プロヴァイド',
  'sit': 'シット', 'stand': 'スタンド', 'lose': 'ルーズ', 'pay': 'ペイ', 'meet': 'ミート', 'include': 'インクルード',
  'continue': 'コンティニュー', 'set': 'セット', 'learn': 'ラーン', 'change': 'チェンジ', 'lead': 'リード',
  'understand': 'アンダースタンド', 'watch': 'ウォッチ', 'follow': 'フォロー', 'stop': 'ストップ',
  'create': 'クリエイト', 'speak': 'スピーク', 'read': 'リード', 'allow': 'アラウ', 'add': 'アッド',
  'spend': 'スペンド', 'grow': 'グロウ', 'open': 'オープン', 'walk': 'ウォーク', 'win': 'ウィン', 'offer': 'オファー',
  'remember': 'リメンバー', 'love': 'ラヴ', 'consider': 'コンシダー', 'appear': 'アピアー', 'buy': 'バイ',
  'wait': 'ウェイト', 'serve': 'サーヴ', 'die': 'ダイ', 'send': 'センド', 'expect': 'エクスペクト', 'build': 'ビルド',
  'stay': 'ステイ', 'fall': 'フォール', 'cut': 'カット', 'reach': 'リーチ', 'kill': 'キル', 'remain': 'リメイン',
  'suggest': 'サジェスト', 'raise': 'レイズ', 'pass': 'パス', 'sell': 'セル', 'require': 'リクワイア',
  'report': 'リポート', 'decide': 'ディサイド', 'return': 'リターン', 'explain': 'エクスプレイン', 'hope': 'ホープ',
  'develop': 'ディヴェロップ', 'carry': 'キャリー', 'break': 'ブレイク', 'receive': 'レシーヴ', 'agree': 'アグリー',
  'support': 'サポート', 'hit': 'ヒット', 'produce': 'プロデュース', 'eat': 'イート', 'cover': 'カヴァー',
  'catch': 'キャッチ', 'draw': 'ドロウ', 'choose': 'チューズ', 'all': 'オール', 'kinds': 'カインズ',
  'feelings': 'フィーリングズ', 'experiences': 'イクスピリエンスィズ', 'journey': 'ジャーニー', 'life': 'ライフ',
  'delight': 'ディライト', 'surprise': 'サプライズ', 'chagrin': 'シャグリン', 'dismay': 'ディスメイ', 'question': 'クエスチョン',
  'guiding': 'ガイディング', 'light': 'ライト', 'really': 'リアリー', 'right': 'ライト', 'now': 'ナウ', 'happy': 'ハッピー',
  'how': 'ハウ', 'what': 'ワット', 'important': 'インポータント', 'i': 'アイ', 'am': 'アム', 'to': 'トゥ', 'and': 'アンド',
  'of': 'オブ', 'in': 'イン', 'you': 'ユー'
};

const vKanaMap: Record<string, string> = {'A':'ア','a̲':'ァ','u̲':'ァ','a̲U':'アウ','AI':'アイ','E̲̅':'エ','E̲r̲':'アー','eI':'エイ','i̲':'ィ','I':'イー','O':'オゥ','OI':'オイ','u':'ゥ','U':'ウー'};
const cKanaMap: Record<string, string> = {
  'SH':'シュ', 'ZH':'ジュ', 'CH':'チュ', 'th':'ス', 'NG':'ング', 'r̲':'ル', 'D̲':'ドゥ', 'Y̲':'イ', 'W̲':'ウ', 'w̲':'ウ',
  'P':'プ', 'B':'ブ', 'T':'トゥ', 'D':'ドゥ', 'K':'ク', 'G':'グ', 'F':'フ', 'v':'ヴ', 'S':'ス', 'Z':'ズ', 'J':'ジュ', 'H':'ハ', 'M':'ム', 'N':'ン', 'l':'ル'
};

function parseConsonantToKatakana(str: string) {
  if (!str || str === '#') return '';
  let res = '';
  let s = str;
  const keys = Object.keys(cKanaMap).sort((a, b) => b.length - a.length);
  while (s.length > 0) {
    let match = false;
    for (let k of keys) {
      if (s.startsWith(k)) {
        res += cKanaMap[k];
        s = s.substring(k.length);
        match = true;
        break;
      }
    }
    if (!match) s = s.substring(1);
  }
  return res;
}

type Beat = { c1: string; v: string; c2: string; wordIndex: number; text: string; displayText: string };
type WordData = { text: string; beats: Beat[]; katakana: string };
type LineData = { originalText: string; processedText: string; words: WordData[]; isUnchanged: boolean };

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<LineData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // ★ デフォルト値20、スライダーの中心に設定（6〜34で極小まで調整可能）
  const [fontSize, setFontSize] = useState<number>(20);
  const [cvcSpacing, setCvcSpacing] = useState<number>(0); 
  const [verticalSpacing, setVerticalSpacing] = useState<number>(2);
  const [pronunciationMode, setPronunciationMode] = useState<number>(0); 
  
  const [isPrintMode, setIsPrintMode] = useState<boolean>(false);
  const [showKatakana, setShowKatakana] = useState<boolean>(true);

  useEffect(() => {
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleConvert = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    
    const lines = inputText.split('\n').filter(line => line.trim() !== '');
    
    const linesData = await Promise.all(lines.map(async (lineText) => {
      let processedText = lineText.toLowerCase();

      if (pronunciationMode === 1) {
        superNativeRules.forEach(rule => {
          processedText = processedText.replace(rule.pattern, rule.replacement);
        });
      }

      const rawWords = processedText.split(/\s+/).filter(w => w !== '');
      let allBeats: Beat[] = [];
      
      for (let wIndex = 0; wIndex < rawWords.length; wIndex++) {
        const rawWord = rawWords[wIndex];
        const searchWord = rawWord.toLowerCase().replace(/[^a-z]/g, '');
        if (!searchWord) continue;

        let displayText = rawWord;
        
        // スペル維持
        if (pronunciationMode === 1) {
            if (searchWord === 'gotchur') displayText = "got your";
            if (searchWord === 'gotcha') displayText = "got you";
            if (searchWord === 'hurchu') displayText = "hurt you";
            if (searchWord === 'whatchur') displayText = "what your";
            if (searchWord === 'catcha') displayText = "catch you";
            if (searchWord === 'dontchu') displayText = "don't you";
            if (searchWord === 'whydontchu') displayText = "why don't you";
            
            if (searchWord === 'withoutchu') displayText = "without you";
            if (searchWord === 'allaboudit') displayText = "all about it";
            if (searchWord === 'wheni') displayText = "when I";
            if (searchWord === 'tellyu') displayText = "tell you";
            if (searchWord === 'wevcoma') displayText = "we've come a";
            if (searchWord === 'fromwherewe') displayText = "from where we";
            if (searchWord === 'allthe') displayText = "all the";
            if (searchWord === 'wevbeenthrough') displayText = "we've been through";
            if (searchWord === 'thatillbe') displayText = "that I'll be";
            if (searchWord === 'standinrighthere') displayText = "standing right here";
            if (searchWord === 'talkintoyou') displayText = "talking to you";
            if (searchWord === 'aboudanother') displayText = "about another";
            if (searchWord === 'hittheroad') displayText = "hit the road";
            if (searchWord === 'butsomethin') displayText = "but something";
            if (searchWord === 'thatitwouldnt') displayText = "that it wouldn't";
            if (searchWord === 'lookatthings') displayText = "look at things";
            if (searchWord === 'seethe') displayText = "see the";
            if (searchWord === 'thosewerethe') displayText = "those were the";
            if (searchWord === 'howcouldwenot') displayText = "how could we not";
            if (searchWord === 'talkabout') displayText = "talk about";
            if (searchWord === 'allthatwegot') displayText = "all that we got";
            if (searchWord === 'everythingi') displayText = "everything I";
            if (searchWord === 'wentthrough') displayText = "went through";
            if (searchWord === 'bymyside') displayText = "by my side";
            if (searchWord === 'andnowyou') displayText = "and now you";
            if (searchWord === 'iminlove') displayText = "I'm in love with";
            if (searchWord === 'shapeofyou') displayText = "shape of you";
            if (searchWord === 'pushand') displayText = "push and";
            if (searchWord === 'magnetdo') displayText = "magnet do";
            if (searchWord === 'lastnightyou') displayText = "last night you";
            if (searchWord === 'smelllikeyou') displayText = "smell like you";
            if (searchWord === 'everyday') displayText = "every day";
            if (searchWord === 'discoverin') displayText = "discovering";
            if (searchWord === 'somethin') displayText = "something";
            if (searchWord === 'brandnew') displayText = "brand new";
            if (searchWord === 'wantyour') displayText = "want your";
            
            if (searchWord === 'whatwere') displayText = "what we're";
            if (searchWord === 'livingin') displayText = "living in";
            if (searchWord === 'letmetellya') displayText = "let me tell ya";
            if (searchWord === 'madeof') displayText = "made of";
            if (searchWord === 'virtualinsanity') displayText = "virtual insanity";
            
            if (searchWord === 'worldssmallest') displayText = "world's smallest";
            if (searchWord === 'needsan') displayText = "needs an";
            if (searchWord === 'blowupinto') displayText = "blow up into";
            if (searchWord === 'thatssuchashame') displayText = "that's such a shame";
            
            if (searchWord === 'loseyourself') displayText = "lose yourself";
            if (searchWord === 'oneopportunity') displayText = "one opportunity";
            if (searchWord === 'palmsare') displayText = "palms are";
            if (searchWord === 'momsspaghetti') displayText = "mom's spaghetti";
            if (searchWord === 'theregoes') displayText = "there goes";

            if (searchWord === 'seeng') displayText = "seeing";
            if (searchWord === 'doin') displayText = "doing";
            if (searchWord === 'goin') displayText = "going";
            if (searchWord === 'evry') displayText = "every";
            if (searchWord === 'camra') displayText = "camera";
            if (searchWord === 'famly') displayText = "family";
            if (searchWord === 'choclate') displayText = "chocolate";
            if (searchWord === 'exacly') displayText = "exactly";
            if (searchWord === 'mosly') displayText = "mostly";
        }

        if (customDict[searchWord]) {
          const parts = customDict[searchWord];
          for (let i = 0; i < parts.length; i += 3) {
            allBeats.push({ c1: parts[i], v: parts[i+1], c2: parts[i+2], wordIndex: wIndex, text: rawWord, displayText });
          }
        } else {
          try {
            const res = await fetch(`https://api.datamuse.com/words?sp=${searchWord}&md=r&max=1`);
            const data = await res.json();
            let phonemes: string[] = [];
            if (data.length > 0 && data[0].tags) {
              const pronTag = data[0].tags.find((tag: string) => tag.startsWith('pron:'));
              if (pronTag) phonemes = pronTag.replace('pron:', '').split(' ');
            }
            
            if (phonemes.length === 0) {
              allBeats.push({ c1: '#', v: '?', c2: '#', wordIndex: wIndex, text: rawWord, displayText: displayText });
              continue;
            }

            let currentBeat = { c1: '#', v: '', c2: '#' };
            for (let i = 0; i < phonemes.length; i++) {
              const rawPhoneme = phonemes[i].replace(/[0-9]/g, '');
              const nodoSymbol = phonemeToNodo[rawPhoneme] || rawPhoneme;
              const isVowel = ['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW'].includes(rawPhoneme);

              if (isVowel) {
                if (currentBeat.v !== '') {
                  allBeats.push({ ...currentBeat, wordIndex: wIndex, text: rawWord, displayText });
                  currentBeat = { c1: '#', v: '', c2: '#' };
                }
                currentBeat.v = nodoSymbol;
              } else {
                if (currentBeat.v === '') currentBeat.c1 = currentBeat.c1 === '#' ? nodoSymbol : currentBeat.c1 + nodoSymbol;
                else currentBeat.c2 = currentBeat.c2 === '#' ? nodoSymbol : currentBeat.c2 + nodoSymbol;
              }
            }
            if (currentBeat.v !== '' || currentBeat.c1 !== '#') {
               if (currentBeat.v === '') currentBeat.v = '#'; 
               allBeats.push({ ...currentBeat, wordIndex: wIndex, text: rawWord, displayText });
            }
          } catch (error) {
            allBeats.push({ c1: '#', v: '?', c2: '#', wordIndex: wIndex, text: rawWord, displayText: displayText });
          }
        }
      }

      // カタカナ分離独立生成
      const katakanaMap = new Map();
      const unlinkedWordGroups = new Map();

      for (const beat of allBeats) {
        if (!unlinkedWordGroups.has(beat.wordIndex)) {
          unlinkedWordGroups.set(beat.wordIndex, { text: beat.text, beats: [] });
        }
        unlinkedWordGroups.get(beat.wordIndex).beats.push({ ...beat });
      }

      unlinkedWordGroups.forEach((group, wIndex) => {
        const searchWord = group.text.toLowerCase().replace(/[^a-z]/g, '');
        
        if (katakanaDict[searchWord]) {
          katakanaMap.set(wIndex, katakanaDict[searchWord]);
        } else {
          let autoKatakana = group.beats.map((b: Beat) => {
            let c1k = parseConsonantToKatakana(b.c1);
            let vk = vKanaMap[b.v] || '';
            let c2k = parseConsonantToKatakana(b.c2);
            return `${c1k}${vk}${c2k}`;
          }).join('');

          if (searchWord.endsWith('ing')) {
            autoKatakana = autoKatakana.replace(/ング$/, 'ン').replace(/ィング$/, 'ィン');
          }
          if (searchWord.endsWith('ts')) {
            autoKatakana = autoKatakana.replace(/トゥス$/, 'ッツ');
          }

          katakanaMap.set(wIndex, autoKatakana);
        }
      });

      // CVCリンキング処理
      for (let i = 1; i < allBeats.length; i++) { if (allBeats[i].c1 === '#') allBeats[i].c1 = allBeats[i-1].c2; }
      for (let i = 0; i < allBeats.length - 1; i++) { if (allBeats[i].c2 === '#' && allBeats[i+1].c1 !== '#') allBeats[i].c2 = allBeats[i+1].c1; }
      for (let i = 0; i < allBeats.length - 1; i++) {
        if (allBeats[i].c2 === 'T' && allBeats[i+1].c1 === 'T') {
          allBeats[i].c2 = 'D̲'; allBeats[i+1].c1 = 'D̲';
        }
      }
      for (let i = 0; i < allBeats.length; i++) {
        let b = allBeats[i];
        let nextB = allBeats[i+1];
        let filler = '#';
        if (['O', 'U', 'IU', 'a̲U'].includes(b.v)) filler = 'w̲';
        else if (['I', 'OI', 'AI', 'eI'].includes(b.v)) filler = 'Y̲';
        if (b.c2 === '#' && filler !== '#') {
          b.c2 = filler; 
          if (nextB && nextB.c1 === '#') nextB.c1 = filler;
        }
      }

      const wordObjs: WordData[] = [];
      let currentWordIndex = -1;
      let currentWordObj: WordData | null = null;
      
      for (const beat of allBeats) {
        if (beat.wordIndex !== currentWordIndex) {
          if (currentWordObj) wordObjs.push(currentWordObj);
          currentWordIndex = beat.wordIndex;
          currentWordObj = { text: beat.displayText, beats: [], katakana: '' };
        }
        currentWordObj?.beats.push(beat);
      }
      if (currentWordObj) wordObjs.push(currentWordObj);

      wordObjs.forEach(w => {
        const wIndex = w.beats[0]?.wordIndex;
        if (wIndex !== undefined && katakanaMap.has(wIndex)) {
          w.katakana = katakanaMap.get(wIndex);
        }
      });

      return { originalText: lineText, processedText: processedText, words: wordObjs, isUnchanged: false };
    }));

    setResults(linesData);
    setIsLoading(false);
  };

  const playAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      const engVoices = availableVoices.filter(v => v.lang.startsWith('en'));
      const bestVoice = engVoices.find(v => v.name.includes('Google US English')) ||
                        engVoices.find(v => v.name.includes('Samantha')) ||
                        engVoices.find(v => v.lang === 'en-US') || engVoices[0];
                        
      if (bestVoice) utterance.voice = bestVoice;
      utterance.lang = 'en-US';
      utterance.rate = pronunciationMode === 1 ? 1.2 : 0.85; 
      window.speechSynthesis.speak(utterance);
    } else {
      alert("お使いのブラウザは音声再生に対応していません。");
    }
  };

  const formatSymbol = (symbol: string, isVowel: boolean = false) => {
    const size = isVowel ? fontSize + 2 : fontSize; 

    if (isPrintMode) {
      if (!symbol || symbol === '#') return <span style={{ fontSize: `${size}px` }} className="text-slate-300 font-light">#</span>;
      if (symbol === 'w̲' || symbol === 'Y̲' || symbol === '?') return <span style={{ fontSize: `${size}px` }} className="font-bold text-slate-400">{symbol}</span>;
      const isVoiceless = voicelessConsonants.some(vc => symbol.includes(vc));
      if (isVowel) return <span style={{ fontSize: `${size}px` }} className="font-black tracking-tighter text-red-600 print:text-red-600">{symbol}</span>;
      if (isVoiceless) return <i style={{ fontSize: `${size}px` }} className="font-serif font-bold text-black">{symbol}</i>;
      return <span style={{ fontSize: `${size}px` }} className="font-bold text-black">{symbol}</span>;
    }

    if (!symbol || symbol === '#') return <span style={{ fontSize: `${size}px` }} className="text-slate-200 font-light">#</span>;
    if (symbol === 'w̲' || symbol === 'Y̲' || symbol === '?') return <span style={{ fontSize: `${size}px` }} className="font-bold text-slate-400">{symbol}</span>;
    
    const isVoiceless = voicelessConsonants.some(vc => symbol.includes(vc));
    if (isVowel) return <span style={{ fontSize: `${size}px` }} className="font-black tracking-tighter text-blue-600">{symbol}</span>;
    if (isVoiceless) return <i style={{ fontSize: `${size}px` }} className="font-serif font-bold text-black">{symbol}</i>;
    return <span style={{ fontSize: `${size}px` }} className="font-bold text-black">{symbol}</span>;
  };

  const executePrint = () => window.print();

  // ==========================================
  // ★ 印刷用画面 UI
  // ==========================================
  if (isPrintMode) {
    return (
      <div className="bg-white print:p-0 print:m-0 min-h-screen p-8 font-sans">
        <div className="flex flex-wrap justify-between items-center mb-10 print:hidden gap-4">
          <button onClick={() => setIsPrintMode(false)} className="text-slate-500 hover:text-slate-800 font-bold px-4 py-2 border border-slate-300 rounded shadow-sm">← 編集画面に戻る</button>
          
          <div className="flex items-center gap-4 flex-wrap bg-slate-50 p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-bold text-slate-600">文字サイズ:</label>
              {/* ★ 極小(6)まで対応。初期値20を中心に設定 */}
              <input type="range" min="6" max="34" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-20 accent-indigo-600" />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-bold text-slate-600">横間隔(CVC):</label>
              <input type="range" min="0" max="20" value={cvcSpacing} onChange={(e) => setCvcSpacing(Number(e.target.value))} className="w-20 accent-indigo-600" />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-bold text-slate-600">縦間隔(余白):</label>
              <input type="range" min="0" max="40" value={verticalSpacing} onChange={(e) => setVerticalSpacing(Number(e.target.value))} className="w-20 accent-indigo-600" />
            </div>
          </div>

          <button onClick={executePrint} className="bg-black text-white font-bold px-8 py-2.5 rounded shadow-md">印刷する</button>
        </div>

        <div className="space-y-8 print:space-y-0">
          {results.map((line, lIndex) => {
            return (
              <div key={lIndex} className="flex flex-wrap items-end gap-y-4 gap-x-2 pb-6 print:gap-y-0 print:gap-x-1 print:pb-1 border-b border-slate-200 print:border-none">
                {line.words.map((wordObj, wIndex) => (
                  <React.Fragment key={wIndex}>
                    <div className="flex flex-col items-center justify-end">
                      {/* ★ UI黄金比：英文をCVCに対してやや小さく（Math.maxで極小時の消失を防止） */}
                      <span style={{ fontSize: `${Math.max(8, fontSize - 2)}px`, marginBottom: `${verticalSpacing}px` }} className="font-bold text-black font-serif tracking-wide capitalize">
                        {wordObj.text}
                      </span>
                      <div className="flex flex-col items-center">
                        <div className="flex items-center">
                          {wordObj.beats.map((beat, bIndex) => (
                            <span key={bIndex} className="flex items-center">
                              {formatSymbol(beat.c1, false)}
                              <span style={{ fontSize: `${Math.max(6, fontSize - 6)}px`, margin: `0 ${cvcSpacing}px` }} className="text-slate-400">-</span>
                              {formatSymbol(beat.v, true)}
                              <span style={{ fontSize: `${Math.max(6, fontSize - 6)}px`, margin: `0 ${cvcSpacing}px` }} className="text-slate-400">-</span>
                              {formatSymbol(beat.c2, false)}
                              {bIndex < wordObj.beats.length - 1 && (
                                <span style={{ fontSize: `${Math.max(8, fontSize - 4)}px`, margin: `0 ${cvcSpacing * 1.5}px` }} className="text-slate-300 font-light">/</span>
                              )}
                            </span>
                          ))}
                        </div>
                        {/* ★ カタカナを英文より少し小さく、しかしかつてよりは大きく調整 */}
                        {showKatakana && wordObj.katakana && (
                          <span style={{ fontSize: `${Math.max(8, fontSize - 4)}px`, marginTop: `${verticalSpacing}px` }} className="text-slate-500 font-bold tracking-widest">{wordObj.katakana}</span>
                        )}
                      </div>
                    </div>
                    {wIndex < line.words.length - 1 && (
                      <span style={{ fontSize: `${Math.max(10, fontSize)}px`, margin: `0 ${cvcSpacing * 1.5}px` }} className="text-slate-300 font-light self-end mb-4 print:mb-0">/</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // ★ 通常画面 UI
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-extrabold mb-2 text-indigo-700 tracking-tight">英語喉 3-Beat 解析エンジン</h1>
            <p className="text-sm text-slate-500 font-medium">究極完成版（極小フォント対応 ＋ CVC黄金比率レイアウト）</p>
          </div>
          <button
            onClick={() => { if (results.length > 0) setIsPrintMode(true); else alert("先に英文を解析してください！"); }}
            className="bg-slate-800 hover:bg-black text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
          >
            🖨️ 印刷用画面へ
          </button>
        </div>
        
        <textarea
          className="w-full h-32 p-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xl font-serif mb-4 transition-colors leading-relaxed"
          placeholder="I know that you got your reasons...&#10;Can hurt you somehow"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center bg-slate-100 p-1.5 rounded-lg border border-slate-200 shadow-sm text-sm">
            {['フォーマル', '超ネイティブ'].map((modeName, idx) => (
              <button
                key={idx}
                onClick={() => setPronunciationMode(idx)}
                className={`px-4 py-2 rounded-md font-bold transition-all duration-200 ${pronunciationMode === idx ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {modeName}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowKatakana(!showKatakana)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors border shadow-sm text-sm ${showKatakana ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}
            >
              <span className="text-lg">🅰️</span> カタカナ {showKatakana ? 'ON' : 'OFF'}
            </button>
            <div className="flex items-center space-x-2 bg-slate-100 p-2.5 rounded-lg border border-slate-200 shadow-sm">
              <label className="text-xs font-bold text-slate-600">文字サイズ:</label>
              {/* ★ 極小(6)まで対応。初期値20を中心に設定 */}
              <input type="range" min="6" max="34" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-16 accent-indigo-600" />
            </div>
            <div className="flex items-center space-x-2 bg-slate-100 p-2.5 rounded-lg border border-slate-200 shadow-sm">
              <label className="text-xs font-bold text-slate-600">横間隔(CVC):</label>
              <input type="range" min="0" max="20" value={cvcSpacing} onChange={(e) => setCvcSpacing(Number(e.target.value))} className="w-16 accent-indigo-600" />
            </div>
            <div className="flex items-center space-x-2 bg-slate-100 p-2.5 rounded-lg border border-slate-200 shadow-sm">
              <label className="text-xs font-bold text-slate-600">縦間隔(余白):</label>
              <input type="range" min="0" max="40" value={verticalSpacing} onChange={(e) => setVerticalSpacing(Number(e.target.value))} className="w-16 accent-indigo-600" />
            </div>
          </div>
        </div>

        <button
          onClick={handleConvert}
          disabled={isLoading}
          className={`w-full text-white font-bold py-4 px-4 rounded-xl transition duration-200 shadow-md text-lg tracking-wider ${isLoading ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'}`}
        >
          {isLoading ? '解析中...' : 'ビート解析を実行'}
        </button>

        <div className="mt-10 space-y-8">
          {results.map((line, lIndex) => {
            return (
              <div key={lIndex} className="relative flex flex-col bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
                
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
                  <span className="text-base font-bold text-slate-600 font-serif capitalize">
                    {line.originalText}
                  </span>
                  
                  <button 
                    onClick={() => playAudio(pronunciationMode === 1 ? line.processedText : line.originalText)}
                    className="flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-full font-bold transition-colors shadow-sm text-xs"
                  >
                    🔊 Listen
                  </button>
                </div>

                <div className="flex flex-wrap items-end gap-y-6 gap-x-2">
                  {line.words.map((wordObj, wIndex) => (
                    <React.Fragment key={wIndex}>
                      <div className="flex flex-col items-center justify-end">
                        {/* ★ UI黄金比：英文をCVCに対してやや小さく設定 */}
                        <span 
                          style={{ fontSize: `${Math.max(8, fontSize - 2)}px`, marginBottom: `${verticalSpacing}px` }} 
                          className="font-bold text-slate-800 font-serif tracking-wide capitalize"
                        >
                          {wordObj.text}
                        </span>
                        
                        <div className="flex flex-col items-center">
                          <div className="flex items-center bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-200">
                            {wordObj.beats.map((beat, bIndex) => (
                              <span key={bIndex} className="flex items-center">
                                {formatSymbol(beat.c1, false)}
                                <span style={{ fontSize: `${Math.max(6, fontSize - 6)}px`, margin: `0 ${cvcSpacing}px` }} className="text-slate-300">-</span>
                                {formatSymbol(beat.v, true)}
                                <span style={{ fontSize: `${Math.max(6, fontSize - 6)}px`, margin: `0 ${cvcSpacing}px` }} className="text-slate-300">-</span>
                                {formatSymbol(beat.c2, false)}
                                
                                {bIndex < wordObj.beats.length - 1 && (
                                  <span style={{ fontSize: `${Math.max(8, fontSize - 4)}px`, margin: `0 ${cvcSpacing * 1.5}px` }} className="text-slate-200 font-light">/</span>
                                )}
                              </span>
                            ))}
                          </div>
                          
                          {/* ★ カタカナを英文より少し小さく、しかしかつてよりは大きく調整 */}
                          {showKatakana && wordObj.katakana && (
                            <span 
                              style={{ fontSize: `${Math.max(8, fontSize - 4)}px`, marginTop: `${verticalSpacing}px` }} 
                              className="text-indigo-500 font-bold tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded"
                            >
                              {wordObj.katakana}
                            </span>
                          )}
                        </div>
                      </div>

                      {wIndex < line.words.length - 1 && (
                        <span style={{ fontSize: `${Math.max(10, fontSize)}px`, margin: `0 ${cvcSpacing * 1.5}px` }} className="text-slate-300 font-light self-end mb-4">/</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
