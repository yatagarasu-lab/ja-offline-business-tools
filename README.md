# ja-offline-business-tools 🇯🇵

**Zero-dependency, 100% offline Python utilities for Japanese e-commerce profit/GMROI calculation, 2026 Invoice System (80% → 70% deduction) verification, and zero-trust PII redaction before sending text to AI chats.**

月額固定費0円・外部通信0バイト・Python標準ライブラリのみで動作する、個人事業主・EC物販セラー・開発者向けの実務CLIツール集です。

🌐 **今すぐブラウザで無料体験（登録不要・外部送信0バイト / Free Instant Browser Demos）:**
- 🚀 **クリーン公式オフラインWebツール集 (JP / EN・CSP外部通信遮断)**: https://yatagarasu-lab.github.io/ja-offline-business-tools/
- 🍎 **Apple Silicon Mac ローカルAI動作診断＆月額API削減シミュレーター**: https://yatagarasu-lab.github.io/ja-offline-business-tools/#panel-macai
- 🛡️ **ChatGPT入力前の個人情報(PII) 1秒ローカル仮名化＆復元ツール**: https://yatagarasu-lab.github.io/ja-offline-business-tools/#panel-pii
- 🧮 **5大ECモール損益分岐・手残り＆年間資金回転率(GMROI)逆算計算機**: https://yatagarasu-lab.github.io/ja-offline-business-tools/#panel-ec

---

## Included Tools / 収録ツール（すべて `pip install` 不要）

### 0. `check_mac_local_ai_env.py` — Apple Silicon Mac ローカルAI 1秒環境診断CLI
お使いのMacのチップ・ユニファイドメモリ容量・Pythonパッケージ環境を外部通信ゼロで診断し、落ちずに動くローカルLLM規模・LoRA推奨パラメータ・日本語リランカー＆NLI検閲の準備状況をJSON出力します。

```bash
python3 check_mac_local_ai_env.py
```

### 0B. `check_mcp_server.py` — ゼロ依存 MCP (Model Context Protocol) サーバー 1秒診断CLI
Claude Desktop / Cursor / Codex 向けのローカル stdio MCP サーバーを起動し、`stdout` 汚染（切断原因No.1）・`initialize` ハンドシェイク・`tools/list` スキーマ・応答ミリ秒を1コマンドで検証します。

```bash
python3 check_mcp_server.py -- python3 your_mcp_server.py
```

### 1. `ec_margin_gmroi.py` — 5大ECモール手残り逆算＆GMROI（年間資金回転効率）判定CLI
メルカリ・Amazon・楽天・Yahoo!ショッピング・BASE の手数料・2026年郵便改定後送料・梱包資材・返品引当（2%）を控除した実質手残り純利益・上限仕入原価（`C_max`）・年間資金回転効率（GMROI）を 1 コマンドで算出します。

```bash
python3 ec_margin_gmroi.py --price 5480 --cost 2400 --shipping 530 --platform mercari --days 10
```

### 2. `pii_redactor.py` — Zero-Trust オフライン個人情報(PII)＆APIキー仮名化・復元CLI
ChatGPT / Claude / Gemini へ業務メール・議事録・ログを貼る前に、メールアドレス・電話番号・郵便番号・12〜16桁番号・APIキー（`sk_live_...`, `ghp_...` 等）をローカル環境だけで一括仮名化し、復元マップをローカル保存します。

```bash
python3 pii_redactor.py sample.txt
```

### 3. `invoice_2026_check.py` — 2026年10月インボイス経過措置（80%→70%控除）試算＆T番号チェックデジット検証CLI
国税庁の登録番号（`T` + 13桁法人番号）の Modulus-11 チェックデジット検証と、2026年10月以降の仕入税額控除（80% → 70%）による年間手残り差額を試算します。

```bash
python3 invoice_2026_check.py --amount-incl-tax 110000 --count 12
python3 invoice_2026_check.py --verify-t-number T1234567890123
```

---

## Detailed Guides & Ready-to-Use Offline Templates / 詳細解説・実践テンプレート（note）

より詳しい運用設計・ブラウザダブルクリック起動版の完全オフラインHTMLツール・24時間常駐ローカルAIパイプライン設計書は note にて公開しています。

- **🔥 【NEW・¥980・pip不要・動くPython本体付】2026年10月インボイス80%→70%対応：Mac純正Apple Vision 領収書・PDF一括OCR→会計CSV＆電帳法リネーム完結ツール**: https://note.com/laughmakerclown/n/nfb413d498428
- **🚀 【看板・¥1,480・実測コード3本付】24GB Mac・API課金¥0で「14B大型AI 75秒LoRA学習・日本語検索0.28秒・ウソ99.9%検閲」を構築する完全ローカルAIスターターキット**: https://note.com/laughmakerclown/n/n21a7bbf8b309
- **🛡️ 【NEW・¥1,480・pip不要コード3本付】DB破壊・パストラバーサル・個人情報漏えい・stdout切断を物理遮断するゼロ依存Python MCPサーバー構築キット**: https://note.com/laughmakerclown/n/n0416d5fead87
- **【¥300・動くHTML＆Python本体付】ChatGPT入力前の個人情報を1秒オフライン黒塗り＆自動復元ツール一式**: https://note.com/laughmakerclown/n/n0db6bc33ab1b
- **【¥300・動くHTML＆Python本体付】5大EC手残り＆上限仕入・GMROI逆算＆CSV保存ツール一式**: https://note.com/laughmakerclown/n/n3cd1dbf7c06d
- **【¥500】毎朝7時に売上・死活監視・優先タスクが届く Python朝刊ブリーフィング自動化スクリプト**: https://note.com/laughmakerclown/n/n43046d84c126
- **【¥1,980】EC・フリマ物販の手残り20%死守 逆算検品式＆送料圧縮セット売り戦略**: https://note.com/laughmakerclown/n/n78ceb516bcb4
- **【¥1,980】API課金ゼロで24時間動くローカルAI自律パイプライン完全設計書**: https://note.com/laughmakerclown/n/nd21e5fc1e917
- **【無料ツール＆記事全まとめ】プロフィール玄関ガイド**: https://note.com/laughmakerclown/n/n1e03a18405fb
- **【無料保存版】2026年10月インボイス「80%→70%控除」3分実務チェック**: https://note.com/laughmakerclown/n/n5f2540e05867
- **【64%OFF・¥4,980】有料実践設計書 コンプリート全集マガジン**: https://note.com/laughmakerclown/m/m3d642d71fd66

---

## Run Tests / テスト実行

```bash
python3 -m unittest discover -s tests -v
```

## License

MIT License — free for personal and commercial use.
*Disclaimer: The tax/invoice calculator provides general arithmetic estimates only and does not constitute individualized tax or legal advice.*
