import { supabase } from './supabase';

export const promoteToFeatured = async (newTokenId) => {
  try {
    const { data: currentFeatured, error: fetchError } = await supabase
      .from('meme_tokens')
      .select('id, featured_order')
      .eq('is_featured', true)
      .order('featured_order', { ascending: true, nullsLast: true });

    if (fetchError) throw fetchError;

    const updates = [];

    currentFeatured.forEach((token, index) => {
      if (index < 2) {
        updates.push(
          supabase
            .from('meme_tokens')
            .update({ featured_order: index + 2 })
            .eq('id', token.id)
        );
      } else {
        updates.push(
          supabase
            .from('meme_tokens')
            .update({ is_featured: false, featured_order: null })
            .eq('id', token.id)
        );
      }
    });

    await Promise.all(updates);

    const { error: promoteError } = await supabase
      .from('meme_tokens')
      .update({ is_featured: true, featured_order: 1 })
      .eq('id', newTokenId);

    if (promoteError) throw promoteError;

    console.log('Token promoted to featured position 1');
  } catch (error) {
    console.error('Error promoting token to featured:', error);
    throw error;
  }
};

export const setFeaturedPosition = async (tokenId, position) => {
  try {
    if (position === null || position === 0) {
      const { error } = await supabase
        .from('meme_tokens')
        .update({ is_featured: false, featured_order: null })
        .eq('id', tokenId);

      if (error) throw error;
      return;
    }

    if (position < 1 || position > 3) {
      throw new Error('Featured position must be between 1 and 3');
    }

    const { data: currentFeatured, error: fetchError } = await supabase
      .from('meme_tokens')
      .select('id, featured_order')
      .eq('is_featured', true)
      .order('featured_order', { ascending: true, nullsLast: true });

    if (fetchError) throw fetchError;

    const existingAtPosition = currentFeatured.find(t => t.featured_order === position);

    if (existingAtPosition && existingAtPosition.id !== tokenId) {
      const otherFeatured = currentFeatured.filter(t => t.id !== tokenId && t.id !== existingAtPosition.id);
      const usedPositions = [position];
      const availablePositions = [1, 2, 3].filter(p => p !== position);

      const updates = [];

      otherFeatured.forEach(token => {
        const nextPos = availablePositions.find(p => !usedPositions.includes(p));
        if (nextPos) {
          usedPositions.push(nextPos);
          updates.push(
            supabase
              .from('meme_tokens')
              .update({ featured_order: nextPos })
              .eq('id', token.id)
          );
        } else {
          updates.push(
            supabase
              .from('meme_tokens')
              .update({ is_featured: false, featured_order: null })
              .eq('id', token.id)
          );
        }
      });

      const bumppedPosition = availablePositions[0];
      updates.push(
        supabase
          .from('meme_tokens')
          .update({ featured_order: bumppedPosition })
          .eq('id', existingAtPosition.id)
      );

      await Promise.all(updates);
    } else {
      const otherFeatured = currentFeatured.filter(t => t.id !== tokenId);
      const usedPositions = [position];
      const availablePositions = [1, 2, 3].filter(p => p !== position);

      const updates = [];

      otherFeatured.forEach(token => {
        const nextPos = availablePositions.find(p => !usedPositions.includes(p));
        if (nextPos) {
          usedPositions.push(nextPos);
          updates.push(
            supabase
              .from('meme_tokens')
              .update({ featured_order: nextPos })
              .eq('id', token.id)
          );
        } else {
          updates.push(
            supabase
              .from('meme_tokens')
              .update({ is_featured: false, featured_order: null })
              .eq('id', token.id)
          );
        }
      });

      await Promise.all(updates);
    }

    const { error: updateError } = await supabase
      .from('meme_tokens')
      .update({ is_featured: true, featured_order: position })
      .eq('id', tokenId);

    if (updateError) throw updateError;

    console.log(`Token set to featured position ${position}`);
  } catch (error) {
    console.error('Error setting featured position:', error);
    throw error;
  }
};

export const getFeaturedTokens = async () => {
  try {
    const { data, error } = await supabase
      .from('meme_tokens')
      .select('*')
      .eq('is_featured', true)
      .order('featured_order', { ascending: true, nullsLast: true })
      .limit(3);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching featured tokens:', error);
    return [];
  }
};
