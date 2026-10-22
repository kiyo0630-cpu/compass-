// 国コード・業種名の日本語表記。attack-map/index.html の COUNTRIES / INDUSTRY_JA と同じ内容（週次・月次レポート用）。
// 変更するときは index.html 側も合わせて更新する。

export const COUNTRY_JA = {"JP":"日本", "US":"アメリカ", "CN":"中国", "RU":"ロシア", "NL":"オランダ", "BG":"ブルガリア", "GB":"イギリス", "DE":"ドイツ", "FR":"フランス",
  "IN":"インド", "BR":"ブラジル", "TW":"台湾", "HK":"香港", "KR":"韓国", "VN":"ベトナム", "IR":"イラン", "ID":"インドネシア", "SG":"シンガポール",
  "UA":"ウクライナ", "TR":"トルコ", "PL":"ポーランド", "RO":"ルーマニア", "IT":"イタリア", "ES":"スペイン", "SE":"スウェーデン", "FI":"フィンランド",
  "LT":"リトアニア", "LV":"ラトビア", "MD":"モルドバ", "SC":"セーシェル", "PA":"パナマ", "CA":"カナダ", "MX":"メキシコ", "AR":"アルゼンチン",
  "CO":"コロンビア", "CL":"チリ", "TH":"タイ", "MY":"マレーシア", "PH":"フィリピン", "BD":"バングラデシュ", "PK":"パキスタン", "KP":"北朝鮮",
  "MN":"モンゴル", "KZ":"カザフスタン", "AU":"オーストラリア", "NZ":"ニュージーランド", "ZA":"南アフリカ", "NG":"ナイジェリア", "EG":"エジプト",
  "KE":"ケニア", "MA":"モロッコ", "DZ":"アルジェリア", "SA":"サウジアラビア", "AE":"アラブ首長国連邦", "IL":"イスラエル", "IQ":"イラク", "CH":"スイス",
  "AT":"オーストリア", "BE":"ベルギー", "CZ":"チェコ", "HU":"ハンガリー", "GR":"ギリシャ", "PT":"ポルトガル", "IE":"アイルランド", "NO":"ノルウェー",
  "DK":"デンマーク", "EE":"エストニア", "BY":"ベラルーシ", "RS":"セルビア", "HR":"クロアチア", "GE":"ジョージア", "AM":"アルメニア", "AZ":"アゼルバイジャン",
  "UZ":"ウズベキスタン", "LK":"スリランカ", "NP":"ネパール", "MM":"ミャンマー", "KH":"カンボジア", "LA":"ラオス", "PE":"ペルー", "VE":"ベネズエラ",
  "EC":"エクアドル", "BO":"ボリビア", "PY":"パラグアイ", "UY":"ウルグアイ", "CR":"コスタリカ", "DO":"ドミニカ共和国", "CU":"キューバ", "PR":"プエルトリコ",
  "GT":"グアテマラ", "LU":"ルクセンブルク", "CY":"キプロス", "MT":"マルタ", "IS":"アイスランド", "TN":"チュニジア", "GH":"ガーナ", "ET":"エチオピア",
  "TZ":"タンザニア", "AO":"アンゴラ", "CM":"カメルーン", "SN":"セネガル", "CI":"コートジボワール", "MZ":"モザンビーク", "ZW":"ジンバブエ", "SK":"スロバキア",
  "SI":"スロベニア", "BA":"ボスニア・ヘルツェゴビナ", "AL":"アルバニア", "MK":"北マケドニア", "KG":"キルギス", "TJ":"タジキスタン", "TM":"トルクメニスタン",
  "AF":"アフガニスタン", "OM":"オマーン", "KW":"クウェート", "QA":"カタール", "JO":"ヨルダン", "LB":"レバノン", "SY":"シリア", "YE":"イエメン",
  "LY":"リビア", "SD":"スーダン", "UG":"ウガンダ", "ZM":"ザンビア", "MU":"モーリシャス", "MG":"マダガスカル", "NA":"ナミビア", "BW":"ボツワナ",
  "HN":"ホンジュラス", "SV":"エルサルバドル", "NI":"ニカラグア", "JM":"ジャマイカ", "TT":"トリニダード・トバゴ", "BZ":"ベリーズ", "PG":"パプアニューギニア",
  "FJ":"フィジー", "MO":"マカオ", "BN":"ブルネイ", "MV":"モルディブ", "BT":"ブータン", "GL":"グリーンランド", "VG":"英領バージン諸島", "KY":"ケイマン諸島",
  "BS":"バハマ", "GI":"ジブラルタル", "IM":"マン島", "JE":"ジャージー", "GG":"ガーンジー", "LI":"リヒテンシュタイン", "ME":"モンテネグロ", "XK":"コソボ",
  "VA":"バチカン", "EU":"欧州（国不明）", "AP":"アジア太平洋（国不明）", "T1":"Tor 出口ノード", "XX":"不明"};

export const INDUSTRY_JA = {
  'gaming':'ゲーム','gambling':'ギャンブル','gambling & gaming':'ギャンブル・ゲーム','internet':'インターネット','internet & telecom':'インターネット・通信',
  'telecommunications':'通信','finance':'金融','financial services':'金融サービス','banking':'銀行','insurance':'保険','cryptocurrency':'暗号資産',
  'government':'政府','government & public sector':'政府・公共','public sector':'公共','military':'軍事','education':'教育','higher education':'高等教育',
  'retail':'小売','e-commerce':'EC','retail & e-commerce':'小売・EC','media':'メディア','entertainment':'エンターテインメント','media & entertainment':'メディア・エンタメ',
  'news':'ニュース','software':'ソフトウェア','computer software':'ソフトウェア','information technology and services':'IT・サービス','information technology & services':'IT・サービス',
  'it services':'IT サービス','hosting':'ホスティング','web hosting':'ホスティング','cloud':'クラウド','healthcare':'医療','health & medicine':'医療・健康','pharmaceuticals':'製薬',
  'transportation':'運輸','travel & tourism':'旅行・観光','airlines':'航空','logistics':'物流','manufacturing':'製造','automotive':'自動車','energy':'エネルギー','utilities':'公益事業',
  'business services':'ビジネスサービス','marketing & advertising':'マーケティング・広告','advertising':'広告','consulting':'コンサルティング','legal':'法務','real estate':'不動産',
  'nonprofit':'非営利','non-profit':'非営利','religion':'宗教','sports':'スポーツ','food & beverage':'食品・飲料','agriculture':'農業','construction':'建設',
  'consumer services':'消費者サービス','consumer electronics':'家電','electronics':'電子機器','adult':'アダルト','dating':'出会い系','social media':'SNS','social networks':'SNS',
  'search engines':'検索エンジン','cybersecurity':'セキュリティ','computer & network security':'セキュリティ','other':'その他','unknown':'不明',
  'internet and telecom':'インターネット・通信','computer and electronics':'コンピュータ・電子機器','computers & electronics':'コンピュータ・電子機器',
  'shopping & general merchandise':'ショッピング・小売','shopping':'ショッピング','professional services':'専門サービス','news, media, and publications':'ニュース・メディア・出版',
  'games':'ゲーム','information services':'情報サービス','computer & network security':'セキュリティ','video games':'ゲーム','research':'研究','online media':'オンラインメディア','computer hardware':'ハードウェア','computer networking':'ネットワーク','information technology':'IT',
  'arts & entertainment':'芸術・エンタメ','reference':'辞書・参考情報','science':'科学','jobs & education':'求人・教育','autos & vehicles':'自動車',
  'home & garden':'住まい','beauty & fitness':'美容・健康','people & society':'社会','law & government':'法律・政府','books & literature':'書籍','pets & animals':'ペット・動物',
  'food & drink':'食品・飲料','hobbies & leisure':'趣味・レジャー','online communities':'オンラインコミュニティ','real estate & construction':'不動産・建設','gambling & games':'ギャンブル・ゲーム'
};

export function industryJa(name){
  const k = String(name || '').trim().toLowerCase();
  if (INDUSTRY_JA[k]) return INDUSTRY_JA[k];
  const rules = [[/gam(bl|e)/,'ゲーム・ギャンブル'],[/financ|bank|insur|fintech/,'金融'],[/crypto/,'暗号資産'],[/telecom/,'通信'],[/internet|isp/,'インターネット'],[/government|public/,'政府・公共'],
    [/educat|school|universit/,'教育'],[/retail|commerce|shopping/,'小売・EC'],[/media|entertain|news|broadcast/,'メディア・エンタメ'],[/software|it |information technology|saas|technolog/,'IT・ソフトウェア'],
    [/health|medic|pharma|hospital/,'医療'],[/travel|tour|airline|hotel/,'旅行・観光'],[/transport|logist/,'運輸・物流'],[/manufactur|industr|automotive/,'製造'],[/energy|utilit|oil|gas/,'エネルギー'],
    [/host|cloud|data ?center/,'ホスティング・クラウド'],[/computer|electronic|hardware|network/,'コンピュータ・電子機器'],[/shopping|merchandise/,'ショッピング・小売'],[/market|advertis/,'マーケティング・広告'],[/business|consult|professional/,'ビジネスサービス'],[/real estate/,'不動産'],[/sport/,'スポーツ'],[/adult|dating/,'アダルト・出会い系'],[/secur/,'セキュリティ']];
  for (const [re, ja] of rules) if (re.test(k)) return ja;
  return null;
}

export function countryJa(code){ const c = String(code || "").toUpperCase(); return COUNTRY_JA[c] || c; }
