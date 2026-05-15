namespace Topica.Api.Modules.AI;

public interface ILmSupplyStatus
{
    bool IsLoading { get; }
    bool IsReady { get; }
    bool IsFailed { get; }
}
