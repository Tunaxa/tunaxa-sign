import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

interface Certificate {
  id: string;
  serialNumber: string;
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  contract: {
    title: string;
  };
  createdAt: string;
}

export function CertificatesPage() {
  const { data, isLoading } = useQuery<{ data: Certificate[] }>({
    queryKey: ["admin", "certificates"],
    queryFn: () => apiGet(`/admin/certificates`),
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Certificates</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generated completion certificates
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="rounded-xl bg-[#121228] border border-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Serial</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Contract</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Subject</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Valid From</th>
                <th className="text-left px-6 py-3 text-xs text-gray-500 uppercase">Valid To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.data.map((cert) => (
                <tr key={cert.id} className="hover:bg-white/5">
                  <td className="px-6 py-4 font-mono text-xs text-gray-400">
                    {cert.serialNumber}
                  </td>
                  <td className="px-6 py-4 text-sm text-white">
                    {cert.contract?.title || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{cert.subject}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(cert.validFrom).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(cert.validTo).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}