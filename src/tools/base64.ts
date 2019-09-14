export function base64ToUint8(base64: string): Uint8ClampedArray 
{
    const raw = window.atob(base64);
    const rawLength = raw.length;
    const array = new Uint8ClampedArray(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) 
    {
        array[i] = raw.charCodeAt(i);
    }

    return array;
}

export function uint8ToBase64(u8Arr: Uint8ClampedArray): string
{
    const CHUNK_SIZE = 0x8000; // arbitrary number
    let index = 0;
    const length = u8Arr.length;
    let result = '';
    
    while (index < length) 
    {
        const slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length)); 
        result += String.fromCharCode.apply(null, slice as any);
        index += CHUNK_SIZE;
    }

    return btoa(result);
}
