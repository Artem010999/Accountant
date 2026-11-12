import { getEmbedding } from '../src/embeddings';

async function main() {
  console.log('--- Проверка вызова getEmbedding("Проверка связи") ---');
  const embedding = await getEmbedding('Проверка связи');

  console.log('Тип результата:', Array.isArray(embedding) ? 'Array' : typeof embedding);
  console.log('Размерность вектора:', embedding.length);
  console.log('Тип первого элемента:', typeof embedding[0]);
  console.log('Первые 5 значений:', embedding.slice(0, 5));

  if (!Array.isArray(embedding)) {
    throw new Error('ОШИБКА: Результат не является массивом!');
  }

  if (embedding.length !== 4096) {
    throw new Error(`ОШИБКА: Ожидалось 4096 измерений, получено ${embedding.length}!`);
  }

  if (!embedding.every((n) => typeof n === 'number' && !isNaN(n))) {
    throw new Error('ОШИБКА: Не все элементы массива являются числами!');
  }

  console.log('ВЕРИФИКАЦИЯ УСПЕШНА: getEmbedding вернул массив ровно из 4096 чисел.');
}

main().catch((err) => {
  console.error('Ошибка проверки:', err);
  process.exit(1);
});
