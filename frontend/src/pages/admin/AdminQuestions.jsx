import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, Trash2, HelpCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminQuestions() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter === "all" ? {} : { answered: filter === "answered" };
    const { data } = await api.get("/admin/questions", { params });
    setItems(data);
    setLoading(false);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const answer = async (id) => {
    const text = (drafts[id] || "").trim();
    if (!text) return toast.error("Write an answer first");
    try {
      await api.put(`/admin/questions/${id}/answer`, { answer: text });
      toast.success("Answer posted");
      setDrafts((d) => ({ ...d, [id]: "" }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to answer");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await api.delete(`/admin/questions/${id}`);
      toast.success("Question deleted");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-brand-primary">Q&amp;A</div>
          <h1 className="font-heading font-bold text-3xl tracking-tight text-slate-900 mt-1">Product Questions</h1>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="answered">Answered</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="card-premium p-8 text-center text-slate-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="card-premium p-8 text-center text-slate-500">No questions.</div>
        ) : items.map((q) => (
          <div key={q.id} className="card-premium p-5" data-testid={`question-row-${q.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 mt-0.5 text-brand-primary shrink-0" />
                  <div className="text-sm font-semibold text-slate-900">{q.question}</div>
                </div>
                <div className="text-xs text-slate-500 mt-1 ml-6">By {q.name} · {new Date(q.created_at).toLocaleDateString("en-IN")}</div>
                {q.answer && (
                  <div className="mt-2 ml-6 text-sm text-slate-700 border-l-2 border-brand-primary/30 pl-3">{q.answer}</div>
                )}
              </div>
              <button onClick={() => remove(q.id)} className="w-9 h-9 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center shrink-0" data-testid={`delete-question-${q.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {!q.answered && (
              <div className="mt-3 ml-6 flex gap-2 items-start">
                <Textarea
                  rows={2}
                  placeholder="Write an answer…"
                  value={drafts[q.id] || ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                  className="flex-1 rounded-xl"
                  data-testid={`answer-input-${q.id}`}
                />
                <button onClick={() => answer(q.id)} className="btn-primary !py-2 shrink-0" data-testid={`answer-submit-${q.id}`}>
                  <Send className="w-3.5 h-3.5" /> Answer
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
