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

type Product = {
  id?: string;
  name: string;
  price: string;
  imageUrl: string;
  desc: string;
  order: number;
};

export default function ShopAdminPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string>('');

  // Load products
  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(firestore, 'shop'), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Product) }));
        setItems(data);
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Fixed single handleAdd
  const handleAdd = async () => {
    if (!newImage) return alert('Please select an image.');
    setSaving(true);

    try {
      const uploaded = await uploadFiles('fileUploader' as any, { files: [newImage] });
      if (!uploaded || !uploaded[0]?.url) throw new Error('No upload URL returned');

      const imageUrl = uploaded[0].url;

      await addDoc(collection(firestore, 'shop'), {
        name: 'New Product',
        price: 'P0',
        imageUrl,
        desc: 'Enter description...',
        order: items.length + 1,
        admin_id: 'admin',
      });

      alert('✅ Product added successfully!');
      setItems((prev) => [
        ...prev,
        {
          id: 'temp-' + Date.now(),
          name: 'New Product',
          price: 'P0',
          imageUrl,
          desc: 'Enter description...',
          order: items.length + 1,
        },
      ]);
      setNewImage(null);
      setNewPreview('');
    } catch (err: any) {
      console.error('Upload or add failed:', err);
      alert('Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  // Update any field
  const handleUpdate = async (id: string, field: keyof Product, value: any) => {
    try {
      const ref = doc(firestore, 'shop', id);
      await updateDoc(ref, { [field]: value, admin_id: 'admin' });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    } catch (err) {
      console.error('Update failed', err);
    }
  };

  // Delete product
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await deleteDoc(doc(firestore, 'shop', id)); // ✅ correct path
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 text-black p-8 font-sans">
      <h1 className="text-3xl font-bold text-black mb-6 flex items-center gap-2">
        🛍️ Manage Shop Products
      </h1>
      <p className="text-sm text-gray-700 mb-8">
        These products appear on the <b>Scents I Love</b> page. Update their image, name,
        description, price, and order below.
      </p>

      {/* Add New Product */}
      <div className="bg-white p-5 rounded-lg shadow-md mb-10 border border-gray-200">
        <h2 className="font-semibold mb-3 text-black flex items-center gap-2">
          <Plus size={18} /> Add New Product
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
            {saving ? 'Uploading...' : 'Add Product'}
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

      {/* Product List */}
      {loading ? (
        <p className="text-gray-700">Loading products...</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col"
            >
              <img
                src={item.imageUrl || '/placeholder.png'}
                alt={item.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4 flex flex-col flex-grow text-black">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleUpdate(item.id!, 'name', e.target.value)}
                  className="font-semibold text-lg mb-1 border-b border-gray-300 focus:outline-none"
                />
                <textarea
                  value={item.desc}
                  onChange={(e) => handleUpdate(item.id!, 'desc', e.target.value)}
                  className="text-sm mb-2 border rounded p-2 flex-grow resize-none bg-gray-50"
                  rows={3}
                />
                <div className="flex justify-between items-center text-sm mt-2">
                  <div className="flex items-center gap-1">
                    <span>Price:</span>
                    <input
                      type="text"
                      value={item.price}
                      onChange={(e) => handleUpdate(item.id!, 'price', e.target.value)}
                      className="border rounded px-2 py-1 w-24 text-center bg-gray-50"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Order:</span>
                    <input
                      type="number"
                      value={item.order}
                      onChange={(e) =>
                        handleUpdate(item.id!, 'order', Number(e.target.value))
                      }
                      className="border rounded px-2 py-1 w-16 text-center bg-gray-50"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(item.id!)}
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
