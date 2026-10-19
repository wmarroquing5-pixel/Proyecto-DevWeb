namespace API_Clinica.R2AdapterProbe;

internal sealed record ProbeGateResult(bool CanExecute, int ExitCode, string Status);

internal static class ProbeExecutionGate
{
    internal const string ExecuteArgument = "--execute-production-r2-adapter-probe";
    internal const string AuthorizationVariable = "API12I_R2_ADAPTER_PROBE_AUTHORIZATION";
    internal const string AuthorizationValue = "API-12I-AUTHORIZED";
    internal const string LockEvidenceVariable = "API12I_API12G5_STATUS";
    internal const string LockEvidenceValue = "API-12G5-VERIFIED";

    internal static ProbeGateResult Evaluate(
        string[] args,
        Func<string, string?> readEnvironment)
    {
        ArgumentNullException.ThrowIfNull(args);
        ArgumentNullException.ThrowIfNull(readEnvironment);

        if (args.Length == 0)
            return new(false, 0, "PREPARATION_ONLY");

        if (args.Length != 1 ||
            !string.Equals(args[0], ExecuteArgument, StringComparison.Ordinal))
            return new(false, 2, "INVALID_ARGUMENT");

        if (!string.Equals(
                readEnvironment(AuthorizationVariable),
                AuthorizationValue,
                StringComparison.Ordinal))
            return new(false, 3, "EXPLICIT_AUTHORIZATION_REQUIRED");

        if (!string.Equals(
                readEnvironment(LockEvidenceVariable),
                LockEvidenceValue,
                StringComparison.Ordinal))
            return new(false, 4, "API12G5_EVIDENCE_REQUIRED");

        return new(true, 0, "EXECUTION_AUTHORIZED");
    }
}
