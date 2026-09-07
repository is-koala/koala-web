/**
 * Backend'in sayfa zarfı.
 *
 * `server-only` yok, bilerek: dilimlenmiş listeleri hem sunucuda çizilen sayfa
 * hem de onun altındaki istemci bileşenleri okuyor, ve modül ağ çağrısı ya da
 * gizli değer taşımıyor.
 *
 * Zarf tek yerde duruyor çünkü backend'de de tek: `PageDto<T>` her sayfalı uçta
 * aynı yedi alanı gönderiyor. Her liste kendi kopyasını yazsaydı alanlardan
 * biri değiştiğinde bir kısmı güncellenip kalanı sessizce eskirdi.
 */
export type BackendPage<T> = {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  readonly first: boolean;
  readonly last: boolean;
};

/**
 * Boş bir sayfa dilimi.
 *
 * Sayfa numarası **sıfır tabanlı** ve parametrenin adı bunu söylüyor. Bu bir
 * üslup tercihi değil, kapatılmış bir tuzak: bu işi yapan iki fonksiyon
 * bitişik dosyalarda aynı adı taşıyıp ters tabanla çalışıyordu
 * (`first: page === 0` ile `first: page === 1`), yani çağıranın hangi tabanla
 * düşündüğü ancak gövdesi okunarak anlaşılıyordu. Taban yanlış seçilirse
 * hatası da sessiz: liste boş olduğu için ekranda görünen bir şey değişmez,
 * yalnız `first` bayrağı yalan söyler ve sayfalama şeridi olmayan bir "önceki
 * sayfa" bağlantısı çizer.
 *
 * Kullanıcıya görünen 1 tabanlı numarayı taşıyan çağıran, çevirmeyi kendi
 * yapar (`page - 1`) — ve artık bunu yaptığını çağrı yerinde gösterir.
 */
export function emptyBackendPage<T>(zeroBasedPage: number, size: number): BackendPage<T> {
  return {
    content: [],
    page: zeroBasedPage,
    size,
    totalElements: 0,
    totalPages: 0,
    first: zeroBasedPage === 0,
    last: true,
  };
}
