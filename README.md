# Migrar desde Gitlab a Github
Script en NodeJS para migrar Issues, Labels, Comments, Members, Milestones desde un repositorio Gitlab a Github, utilizando la API de estos servicios.

## Uso

1. En el directorio del proyecto ejecutar `npm install`
2. En el archivo `migrations_data.json` definir los tokens de acceso para Gitlab y Github.
3. En el parámetro `MIGRATE_REPOS` definir un array de objetos con los repositorios a migrar.
4. Para comenzar la migración ejecutar `npm run start-migration`