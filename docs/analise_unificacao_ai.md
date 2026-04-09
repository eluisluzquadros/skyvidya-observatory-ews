# Análise de Unificação: ORACLE e GeoRAG 🤖

Sua intuição está corretíssima. Separar "Oracle" (Tactical AI) e "GeoRAG" em abas distintas na sidebar cria uma fricção cognitiva para o usuário, que precisa decidir *qual* inteligência usar antes de fazer a pergunta. Uma abordagem unificada é muito superior do ponto de vista de UX (User Experience).

Abaixo apresento minha percepção arquitetural e o plano de ação sugerido.

---

## 👁️ Percepção Analítica

### Ponto Atual
Atualmente, o [App.tsx](file:///c:/Users/eluzq/workspace/s2id-disaster-monitor/App.tsx) possui a sidebar direita (`RIGHT_TABS`) com as abas `ai` ([TacticalAI.tsx](file:///c:/Users/eluzq/workspace/s2id-disaster-monitor/components/TacticalAI.tsx)) e `georag` ([GeoRAGChat.tsx](file:///c:/Users/eluzq/workspace/s2id-disaster-monitor/components/GeoRAGChat.tsx)). 
- **Command Oracle**: Focado em dados táticos da interface, correlacionando o contexto (Risk Data, events).
- **GeoRAG**: Focado em buscar referências espaciais e textuais via RAG diretamente do backend Python.

### Por que unificar faz sentido?
1. **Redução de Carga Cognitiva**: O usuário não quer saber se a resposta vem de RAG ou de Contexto de UI; ele quer apenas "a resposta". Um assistente unificado (Single Point of Contact) abstrai essa complexidade tecnológica.
2. **Otimização de Espaço (Real Estate)**: A sidebar direita já está bem povoada com itens essenciais de dados puros (Detalhe, News, Risco, Economia). Remover as duas abas de IA libera muito espaço e torna a navegação entre os painéis de dados fluida.
3. **Padrão de Mercado (Mental Model)**: Chatbots/Copilots geralmente vivem em um "Floating Action Button" (FAB) no canto inferior da tela (ex: intercom, copilots SaaS). Isso permite que o usuário interaja com a IA **enquanto** visualiza os dados na sidebar direita, e não no lugar deles.

---

## 📋 Plano de Ação (Action Plan)

Caso decida avançar com esta feature, recomendo a execução em 3 fases:

### Fase 1: Arquitetura do Componente Flutuante (UI/UX)
1. **Criar `<AIAssistant />`**: Desenvolver um componente de chat popover flutuante (posicionado em `bottom-right`), com um botão "trigger" que abre/fecha o chat.
2. **Atualizar [App.tsx](file:///c:/Users/eluzq/workspace/s2id-disaster-monitor/App.tsx)**: Remover `ai` e `georag` da lista `RIGHT_TABS`. Renderizar o novo componente `<AIAssistant />` sobrepondo o mapa (com as devidas props de contexto passando dados do mapa/município ativo).

### Fase 2: Roteamento de Intenção (O Cérebro)
Para unificar a experiência sem quebrar as regras de negócios, precisamos de um "Router" no front-end ou back-end:
- **Abordagem A (Comandos / Slash Commands)**: A mais simples. O input do chat passa a aceitar `/georag [pergunta]` para forçar a busca espacial, e queries normais vão para o Oracle.
- **Abordagem B (Agentic Routing Clássico)**: Enviar *toda* pergunta primeiro para o Gemini via [geminiService.ts](file:///c:/Users/eluzq/workspace/s2id-disaster-monitor/services/geminiService.ts) com um prompt de classificação, para que o modelo decida: "Isso requer acessar a base vetorial do GeoRAG ou posso responder apenas com os dados do painel ativo?". Dependendo da resposta, invoca-se o Python (GeoRAG) ou gera-se o insight tático local (Oracle).
  
> *Recomendação:* Começar com a **A** (com botões de "modo" rápido ou comandos) para iterar rápido na UI, evoluindo para a **B** quando o backend estiver mais maduro.

### Fase 3: Fusão de UX (Resultados Ricos)
O [GeoRAGChat.tsx](file:///c:/Users/eluzq/workspace/s2id-disaster-monitor/components/GeoRAGChat.tsx) atual possui UI rica (ex: lista de municípios clicáveis e exportação CSV/GeoJSON). 
1. Mesclar a renderização condicional: o novo chat deve ser capaz de mostrar respostas de texto estilizadas do Oracle **e** renderizar cards de municípios do GeoRAG na mesma timeline de mensagens.
2. Manter a capacidade de "clicar" em um município sugerido pela IA e a interface principal abrir o painel detalhado do respectivo local na sidebar.

---

### Conclusão

A mudança é viável, estrategicamente excelente para o produto (aproxima-se de uma interface "comandada por IA") e libera o dashboard para seu foco primário: exploração visual de dados analíticos. 

Se quiser que eu crie o plano de implementação (`implementation_plan.md`) ou comece a rascunhar o código do novo `<AIAssistant />`, basta me avisar qual abordagem de roteamento (A ou B) você prefere!
