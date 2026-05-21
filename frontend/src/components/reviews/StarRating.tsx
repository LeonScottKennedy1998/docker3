import React, { useState } from 'react';
import type { StarRatingProps } from '../../types/props';

const StarRating: React.FC<StarRatingProps> = ({ 
    rating, 
    onRatingChange, 
    readonly = false, 
    size = 'medium' 
}) => {
    const [hoverRating, setHoverRating] = useState(0);
    
    const sizeMap = {
        small: '18px',
        medium: '24px',
        large: '32px'
    };
    
    return (
        <div style={{ display: 'inline-flex', gap: '4px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    style={{
                        fontSize: sizeMap[size],
                        cursor: readonly ? 'default' : 'pointer',
                        color: (star <= (hoverRating || rating)) ? '#ffc107' : '#ddd',
                        transition: 'all 0.2s'
                    }}
                    onClick={() => !readonly && onRatingChange?.(star)}
                    onMouseEnter={() => !readonly && setHoverRating(star)}
                    onMouseLeave={() => !readonly && setHoverRating(0)}
                >
                    ★
                </span>
            ))}
        </div>
    );
};

export default StarRating;