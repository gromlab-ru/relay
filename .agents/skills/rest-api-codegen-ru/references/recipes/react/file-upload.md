# Загрузка файла

Сгенерированная операция принимает `File` и передаёт его через `FormData`.

```ts
import type { FileUpload } from "../../infra/pet-store-api/generated";
import { petStoreApi } from "../../infra/pet-store-api/pet-store-api";

export function uploadImage(file: File) {
  const payload: FileUpload = {
    file,
    metadata: { source: "browser" },
  };

  return petStoreApi.files.uploadFile(payload);
}
```

Не задавайте `Content-Type` вручную: браузер сам добавит корректный `boundary` для `FormData`.
