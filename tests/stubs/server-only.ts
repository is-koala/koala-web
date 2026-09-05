// `server-only` gerçek bir modül değil, derleyici işareti: Next onu client
// derlemesinde patlayan bir dosyaya çözer. Vitest'in Next derleyicisi yok, bu
// yüzden testlerde boş bir modüle bağlanır.
export {};
