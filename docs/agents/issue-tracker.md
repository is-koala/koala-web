# Issue tracker: GitHub

Bu reponun issue ve teknik kapsamları GitHub Issues içindedir.

Repository: `is-koala/koala-web`

Tracker işlemlerinde `gh` CLI kullanılır. PR, talep yüzeyi değildir; iş kapsamı
issue üzerinden okunur. Başka repo değişecekse her repoda ayrı issue açılır ve
karşılıklı bağlantı kurulur.

- Oku: `gh issue view <number> --comments`
- Listele: `gh issue list --state open`
- Yorumla: `gh issue comment <number> --body "..."`
- Etiketle: `gh issue edit <number> --add-label "..."`
