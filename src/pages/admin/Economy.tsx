import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, Gift, Zap, Package } from 'lucide-react';

interface GiftCatalogItem {
  id: string;
  name: string;
  coin_cost: number;
  rarity: string;
  is_active: boolean;
}

interface BoosterCatalogItem {
  id: string;
  name: string;
  coin_cost: number;
  effect_type: string;
  is_active: boolean;
}

export default function AdminEconomy() {
  const [gifts, setGifts] = useState<GiftCatalogItem[]>([]);
  const [boosters, setBoosters] = useState<BoosterCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [giftsRes, boostersRes] = await Promise.all([
        supabase.from('gifts_catalog').select('*').order('coin_cost'),
        supabase.from('booster_catalog').select('*').order('coin_cost'),
      ]);

      setGifts(giftsRes.data || []);
      setBoosters(boostersRes.data || []);
    } catch (error) {
      console.error('Failed to load economy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateGiftPrice = async (giftId: string, newPrice: number) => {
    try {
      const { error } = await supabase
        .from('gifts_catalog')
        .update({ coin_cost: newPrice })
        .eq('id', giftId);

      if (error) throw error;
      alert('Price updated');
      loadData();
    } catch (error) {
      console.error('Failed to update price:', error);
      alert('Failed to update price');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-[#E6B36A]" />
          Economy Controls
        </h1>

        {/* Coin Packages */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-500" />
            Coin Packages
          </h2>
          <div className="bg-gray-800 rounded-lg p-6">
            <p className="text-gray-400">Managed via coin_packages table</p>
          </div>
        </div>

        {/* Gifts Catalog */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Gift className="w-6 h-6 text-pink-500" />
            Gifts Catalog ({gifts.length})
          </h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Gift</th>
                  <th className="px-4 py-3 text-left">Rarity</th>
                  <th className="px-4 py-3 text-left">Price (Coins)</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {gifts.map(gift => (
                  <tr key={gift.id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-semibold">{gift.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-purple-600 rounded text-xs">{gift.rarity}</span>
                    </td>
                    <td className="px-4 py-3 text-[#E6B36A] font-bold">{gift.coin_cost}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          gift.is_active ? 'bg-green-600' : 'bg-gray-600'
                        }`}
                      >
                        {gift.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          const newPrice = prompt(`New price for ${gift.name}:`, String(gift.coin_cost));
                          if (newPrice) updateGiftPrice(gift.id, parseInt(newPrice));
                        }}
                        className="px-3 py-1 bg-[#E6B36A] text-black rounded hover:bg-[#E6B36A]/90 text-sm"
                      >
                        Edit Price
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Boosters Catalog */}
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Boosters Catalog ({boosters.length})
          </h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Booster</th>
                  <th className="px-4 py-3 text-left">Effect</th>
                  <th className="px-4 py-3 text-left">Price (Coins)</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {boosters.map(booster => (
                  <tr key={booster.id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-semibold">{booster.name}</td>
                    <td className="px-4 py-3 text-gray-400">{booster.effect_type}</td>
                    <td className="px-4 py-3 text-[#E6B36A] font-bold">{booster.coin_cost}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          booster.is_active ? 'bg-green-600' : 'bg-gray-600'
                        }`}
                      >
                        {booster.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
