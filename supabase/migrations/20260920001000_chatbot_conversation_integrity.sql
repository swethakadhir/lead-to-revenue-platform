-- A conversation's current node must belong to its chatbot configuration.
alter table public.conversations
  add constraint conversations_current_node_config_fk
  foreign key (current_node_id, chatbot_config_id)
  references public.chatbot_nodes (id, chatbot_config_id);
