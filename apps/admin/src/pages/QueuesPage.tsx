import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

interface QueueInfo {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export function QueuesPage() {
  const { data, isLoading } = useQuery<{ data: QueueInfo[] }>({
    queryKey: ["admin", "queues"],
    queryFn: () => apiGet(`/admin/queues`),
  });

  const queueColors = [
    "border-blue-500/30 text-blue-300",
    "border-purple-500/30 text-purple-300",
    "border-green-500/30 text-green-300",
    "border-yellow-500/30 text-yellow-300",
    "border-red-500/30 text-red-300",
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Redis Queues</h1>
        <p className="text-sm text-gray-500 mt-1">
          BullMQ worker queue status
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data.map((queue, i) => (
            <div
              key={queue.name}
              className="rounded-xl bg-[#121228] border border-white/5 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">{queue.name}</h3>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs border ${
                    queueColors[i % queueColors.length]
                  }`}
                >
                  {queue.active > 0 ? "Active" : "Idle"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Waiting</p>
                  <p className="text-white font-medium">{queue.waiting}</p>
                </div>
                <div>
                  <p className="text-gray-500">Active</p>
                  <p className="text-white font-medium">{queue.active}</p>
                </div>
                <div>
                  <p className="text-gray-500">Completed</p>
                  <p className="text-green-400">{queue.completed}</p>
                </div>
                <div>
                  <p className="text-gray-500">Failed</p>
                  <p className={queue.failed > 0 ? "text-red-400" : "text-gray-400"}>
                    {queue.failed}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}