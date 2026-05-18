import {
  IvsClient,
  CreateChannelCommand,
  CreateStreamKeyCommand,
  ChannelType,
  ChannelLatencyMode,
} from "@aws-sdk/client-ivs";

const ivsClient = new IvsClient({
  region: process.env.AWS_REGION || "us-east-1",
});

type CriarCanalIvsParams = {
  nome: string;
};

export async function criarCanalIvsParaAula({ nome }: CriarCanalIvsParams) {
  const createChannel = await ivsClient.send(
    new CreateChannelCommand({
      name: nome,
      type: (process.env.IVS_CHANNEL_TYPE as ChannelType) || "STANDARD",
      latencyMode: (process.env.IVS_LATENCY_MODE as ChannelLatencyMode) || "LOW",
      authorized: false,
    })
  );

  const channel = createChannel.channel;

  if (!channel?.arn || !channel?.ingestEndpoint || !channel?.playbackUrl) {
    throw new Error("Falha ao criar canal IVS. Dados do canal incompletos.");
  }

  const createStreamKey = await ivsClient.send(
    new CreateStreamKeyCommand({
      channelArn: channel.arn,
    })
  );

  const streamKey = createStreamKey.streamKey;

  if (!streamKey?.arn || !streamKey?.value) {
    throw new Error("Falha ao criar stream key IVS.");
  }

  return {
    channelArn: channel.arn,
    streamKeyArn: streamKey.arn,
    ingestEndpoint: channel.ingestEndpoint,
    playbackUrl: channel.playbackUrl,
    streamKey: streamKey.value,
  };
}