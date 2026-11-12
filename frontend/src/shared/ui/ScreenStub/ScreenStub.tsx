import './ScreenStub.css';

// Заглушка экрана на G0: только заголовок из дизайна. Содержимое экрана добавляет агент своей группы.
export interface ScreenStubProps {
  /** Имя экрана, совпадает с именем файла эталона (без .dc.html). */
  name: string;
  /** Первый заголовок h1 из эталона. */
  title: string;
}

export function ScreenStub({ name, title }: ScreenStubProps) {
  return (
    <section className="screen-stub" data-screen={name} data-design={`${name}.dc.html`}>
      <h1 className="t-screen-title">{title}</h1>
    </section>
  );
}
