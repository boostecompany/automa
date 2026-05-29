import aiAgentAction from './handlerAiAgentAction';
import aiPageSnapshot from './handlerAiPageSnapshot';

export default function () {
  return {
    aiPageSnapshot,
    aiAgentAction,
  };
}
