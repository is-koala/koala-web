import { Icon } from "./icon";

/**
 * SSS akordeonu. `details`/`summary` betiksiz çalışır ve klavyeyle açılır;
 * ortak `name` bir anda tek maddeyi açık tutar (mockup davranışı).
 */
export function FaqList({
  items,
  name = "koala-sss",
}: {
  items: ReadonlyArray<{ question: string; answer: string }>;
  name?: string;
}) {
  return (
    <div className="mk-faq">
      {items.map((item) => (
        <details key={item.question} className="mk-faq-item" name={name}>
          <summary>
            <span>{item.question}</span>
            <Icon name="plus" className="mk-faq-icon" />
          </summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
