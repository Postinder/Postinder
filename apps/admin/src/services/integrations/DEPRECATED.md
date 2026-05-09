# Integrações - Deprecadas

Este diretório contém integrações que estão sendo refatoradas para serem chamadas via Backend API.

## Status

- [ ] Reimplementar integrations como endpoints no backend
- [ ] Atualizar chamadas do frontend para usar `apiClient`
- [ ] Remover dependências diretas do frontend

## Próximas Etapas

1. Criar endpoints no backend para cada integração:
   - POST `/integrations/ai/generate`
   - POST `/integrations/canva/templates`
   - POST `/integrations/whatsapp/send`
   - POST `/integrations/gohighlevel/sync`
   - POST `/integrations/email/send`

2. Atualizar componentes do frontend para usar os novos endpoints

3. Mover lógica de integração para o backend
