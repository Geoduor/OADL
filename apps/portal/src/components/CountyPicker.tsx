import { useMemo, useState } from 'react';
import type { County } from '../lib/types.js';

interface Props {
  counties: County[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

// Checkbox list with a search box (47 counties is too long to scan).
export function CountyPicker({ counties, selected, onChange }: Props) {
  const [search, setSearch] = useState('');
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? counties.filter((county) => county.name.toLowerCase().includes(term))
      : counties;
  }, [counties, search]);

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="picker">
      <input
        type="search"
        placeholder="Search counties"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <p className="muted">{selected.length} selected</p>
      <div className="picker-list">
        {shown.map((county) => (
          <label key={county.id} className="check">
            <input
              type="checkbox"
              checked={selected.includes(county.id)}
              onChange={() => toggle(county.id)}
            />
            {county.name}
          </label>
        ))}
      </div>
    </div>
  );
}
