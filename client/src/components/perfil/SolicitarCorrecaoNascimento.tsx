import SolicitacaoNascimentoDocumental from
  "../profile/SolicitacaoNascimentoDocumental.js";

type Props = {
  token: string;
  onClose: () => void;
};

export default function SolicitarCorrecaoNascimento({
  token,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Corrigir data de nascimento"
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end p-3 pb-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Fechar
          </button>
        </div>

        <SolicitacaoNascimentoDocumental
          token={token}
        />
      </div>
    </div>
  );
}