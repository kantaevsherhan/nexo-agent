import { useState, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { Agent } from "../core/agent.js";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AppProps {
  agent: Agent;
}

export function App({ agent }: AppProps): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const { exit } = useApp();

  useEffect(() => {
    agent.setCallbacks({
      onToolStart: (name) => {
        setCurrentResponse((prev) => prev + `\n  [tool: ${name}]\n`);
      },
      onToolComplete: (name) => {
        setCurrentResponse((prev) => prev + `  [done: ${name}]\n`);
      },
    });
  }, [agent]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
    }
  });

  const handleSubmit = async (value: string): Promise<void> => {
    if (!value.trim() || isProcessing) return;

    const userMessage = value.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsProcessing(true);
    setCurrentResponse("");

    try {
      const response = await agent.chat(userMessage);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setIsProcessing(false);
      setCurrentResponse("");
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
        <Text bold color="cyan">
          Nexo Agent v0.1.0
        </Text>
        <Text color="gray"> | </Text>
        <Text color="gray">Type your message (Ctrl+C to exit)</Text>
      </Box>

      <Box flexDirection="column" overflow="hidden">
        {messages.map((msg, i) => (
          <Box key={i} marginBottom={1}>
            <Text bold color={msg.role === "user" ? "green" : "cyan"}>
              {msg.role === "user" ? "You: " : "Agent: "}
            </Text>
            <Text>{msg.content}</Text>
          </Box>
        ))}
        {currentResponse && (
          <Box marginBottom={1}>
            <Text bold color="cyan">Agent: </Text>
            <Text>{currentResponse}</Text>
          </Box>
        )}
      </Box>

      <Box borderStyle="round" borderColor="green" padding={1}>
        <Text bold color="green">{'>'} </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={isProcessing ? "Processing..." : "Type a message..."}
        />
      </Box>
    </Box>
  );
}
