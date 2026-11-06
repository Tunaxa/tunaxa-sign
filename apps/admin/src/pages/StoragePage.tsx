import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

interface BucketInfo {
  bucket: string;
  objectCount: number;
  totalBytes: number;
  lastUpload: string | null;
  region: string;
}

export function StoragePage() {
  const { data, isLoading } = useQuery<{ data: BucketInfo[] }>({
    queryKey: ["admin", "storage"],
    queryFn: () => apiGet(`/admin/storage`),
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const folders = ["original", "processed", "signed", "certificates", "audit", "templates"];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Object Storage</h1>
        <p className="text-sm text-gray-500 mt-1">
          MinIO / S3 bucket usage by folder
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data.map((bucket) => (
            <div
              key={bucket.bucket}
              className="rounded-xl bg-[#121228] border border-white/5 p-6"
            >
              <h3 className="font-semibold text-white mb-3">{bucket.bucket}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Objects</span>
                  <span className="text-gray-300">{bucket.objectCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Size</span>
                  <span className="text-gray-300">{formatBytes(bucket.totalBytes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Region</span>
                  <span className="text-gray-300">{bucket.region}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Folder legend */}
          <div className="rounded-xl bg-[#121228] border border-white/5 p-6">
            <h3 className="font-semibold text-white mb-3">Folder Structure</h3>
            <div className="space-y-1.5">
              {folders.map((folder) => (
                <div
                  key={folder}
                  className="flex items-center gap-2 font-mono text-xs text-gray-400"
                >
                  <span className="text-blue-400">▸</span> {folder}/
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}