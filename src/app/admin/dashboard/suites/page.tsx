'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
} from 'firebase/firestore';
import { firestore } from '@/utils/firebaseConfig';
import { uploadFiles } from '@/utils/uploadthing';
import { Plus, Trash2 } from 'lucide-react';

type Suite = {
  id?: string;
  name: string;
  size: string;
  imageUrl: string;
  desc: string;
  highlights: string[];
  price: string;
  order: number;
};

export default function SuitesAdminPage() {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(firestore, 'suites'), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Suite) }));
        setSuites(data);
      } catch (err) {
        console.error('Error fetching suites:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAdd = async () => {
    if (!newImage) return alert('Please select an image.');
    setSaving(true);
    try {
      const uploaded = await uploadFiles('fileUploader' as any, { files: [newImage] });
      const imageUrl = uploaded?.[0]?.url || '';
      await addDoc(collection(firestore, 'suites'), {
        name: 'New Suite',
        size: 'Size (e.g. 25 sqm)',
        imageUrl,
        desc: 'Enter description...',
        highlights: ['Add amenities...'],
        price: 'P0/night',
        order: suites.length + 1,
        admin_id: 'admin',
      });
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to add suite');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, field: keyof Suite, value: any) => {
    try {
      const ref = doc(firestore, 'suites', id);
      await updateDoc(ref, { [field]: value });
      setSuites((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    } catch (err) {
      console.error('Update failed', err);
    }
  };

  const handleHighlightChange = (id: string, index: number, value: string) => {
    const suite = suites.find((s) => s.id === id);
    if (!suite) return;
    const updatedHighlights = [...suite.highlights];
    updatedHighlights[index] = value;
    handleUpdate(id, 'highlights', updatedHighlights);
  };

  const addHighlightLine = (id: string) => {
    const suite = suites.find((s) => s.id === id);
    if (!suite) return;
    const updated = [...suite.highlights, 'New highlight'];
    handleUpdate(id, 'highlights', updated);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this suite?')) return;
    try {
      await deleteDoc(doc(firestore, 'suites', id));
      setSuites((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 text-black p-8 font-sans">
      <h1 className="text-3xl font-bold text-black mb-6 flex items-center gap-2">
        🛏️ Manage Suites
      </h1>
      <p className="text-sm text-gray-700 mb-8">
        These suites appear on the <b>Our Suites</b> page. Update their image, size, details,
        amenities, and pricing.
      </p>

      {/* Add New Suite */}
      <div className="bg-white p-5 rounded-lg shadow-md mb-10 border border-gray-200">
        <h2 className="font-semibold mb-3 text-black flex items-center gap-2">
          <Plus size={18} /> Add New Suite
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setNewImage(file);
              if (file) setNewPreview(URL.createObjectURL(file));
            }}
            className="border p-2 rounded w-full sm:w-1/2"
          />
          <button
            disabled={saving}
            onClick={handleAdd}
            className="bg-black text-white px-5 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Uploading...' : 'Add Suite'}
          </button>
        </div>
        {newPreview && (
          <img
            src={newPreview}
            alt="New preview"
            className="mt-4 rounded-lg shadow-md max-h-60 object-cover border"
          />
        )}
      </div>

      {/* Existing Suites */}
      {loading ? (
        <p className="text-gray-700">Loading suites...</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suites.map((suite) => (
            <div
              key={suite.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col"
            >
              <img
                src={suite.imageUrl || '/placeholder.png'}
                alt={suite.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4 flex flex-col flex-grow text-black">
                <input
                  type="text"
                  value={suite.name}
                  onChange={(e) => handleUpdate(suite.id!, 'name', e.target.value)}
                  className="font-semibold text-lg mb-1 border-b border-gray-300 focus:outline-none"
                />
                <input
                  type="text"
                  value={suite.size}
                  onChange={(e) => handleUpdate(suite.id!, 'size', e.target.value)}
                  className="text-sm mb-2 italic border-b border-gray-200 focus:outline-none"
                />
                <textarea
                  value={suite.desc}
                  onChange={(e) => handleUpdate(suite.id!, 'desc', e.target.value)}
                  className="text-sm mb-3 border rounded p-2 flex-grow resize-none bg-gray-50"
                  rows={3}
                />

                {/* Highlights */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Highlights / Amenities
                  </label>
                  {suite.highlights.map((h, i) => (
                    <input
                      key={i}
                      type="text"
                      value={h}
                      onChange={(e) =>
                        handleHighlightChange(suite.id!, i, e.target.value)
                      }
                      className="w-full border rounded px-2 py-1 mb-1 text-sm"
                    />
                  ))}
                  <button
                    onClick={() => addHighlightLine(suite.id!)}
                    className="text-black text-xs hover:underline"
                  >
                    + Add more
                  </button>
                </div>

                {/* Price + Order */}
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1">
                    <span>Price:</span>
                    <input
                      type="text"
                      value={suite.price}
                      onChange={(e) => handleUpdate(suite.id!, 'price', e.target.value)}
                      className="border rounded px-2 py-1 w-24 text-center bg-gray-50"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Order:</span>
                    <input
                      type="number"
                      value={suite.order}
                      onChange={(e) =>
                        handleUpdate(suite.id!, 'order', Number(e.target.value))
                      }
                      className="border rounded px-2 py-1 w-16 text-center bg-gray-50"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(suite.id!)}
                  className="mt-3 flex items-center justify-center gap-2 text-red-600 hover:text-red-700 text-sm"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
