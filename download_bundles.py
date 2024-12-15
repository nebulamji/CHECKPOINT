import os
import sys
import requests
from tqdm import tqdm

BUNDLES = {
    'attention_rnn.mag': 'https://storage.googleapis.com/download.magenta.tensorflow.org/models/attention_rnn.mag',
    'drum_kit_rnn.mag': 'https://storage.googleapis.com/download.magenta.tensorflow.org/models/drum_kit_rnn.mag',
    'cat-mel_2bar_big.tar': 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_2bar_big'
}

def download_file(url, filename, filepath):
    """Download a file with progress bar."""
    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        total_size = int(response.headers.get('content-length', 0))

        with open(filepath, 'wb') as f, tqdm(
            desc=f'Downloading {filename}',
            total=total_size,
            unit='iB',
            unit_scale=True,
            unit_divisor=1024,
        ) as pbar:
            for data in response.iter_content(chunk_size=1024):
                size = f.write(data)
                pbar.update(size)
        return True
    except Exception as e:
        print(f'\nError downloading {filename}: {str(e)}', file=sys.stderr)
        if os.path.exists(filepath):
            os.remove(filepath)
        return False

def download_bundles():
    """Download all required model bundles."""
    bundle_dir = os.path.join(os.path.dirname(__file__), 'bundles')
    if not os.path.exists(bundle_dir):
        os.makedirs(bundle_dir)

    success = True
    for filename, url in BUNDLES.items():
        filepath = os.path.join(bundle_dir, filename)
        if not os.path.exists(filepath):
            print(f'\nAttempting to download {filename}...')

            # Try primary URL
            if not download_file(url, filename, filepath):
                # Try alternative URLs if primary fails
                alt_urls = {
                    'cat-mel_2bar_big.tar': [
                        'https://storage.googleapis.com/magentadata/models/music_vae/checkpoints/cat-mel_2bar_big.tar',
                        'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_2bar_big.tar',
                        'https://cdn.openai.com/magenta/music_vae/checkpoints/cat-mel_2bar_big.tar'
                    ]
                }

                if filename in alt_urls:
                    print(f'\nTrying alternative sources for {filename}...')
                    for alt_url in alt_urls[filename]:
                        print(f'\nTrying: {alt_url}')
                        if download_file(alt_url, filename, filepath):
                            break
                    else:
                        success = False
                        print(f'\n❌ Failed to download {filename} from all sources')
                else:
                    success = False
            else:
                print(f'\n✅ Successfully downloaded {filename}')
        else:
            print(f'\n✓ {filename} already exists')

    if success:
        print('\n🎉 All bundles downloaded successfully!')
    else:
        print('\n⚠️  Some downloads failed. Please try again or download manually.')
        sys.exit(1)

if __name__ == '__main__':
    try:
        download_bundles()
    except KeyboardInterrupt:
        print('\n\nDownload cancelled by user')
        sys.exit(1)
    except Exception as e:
        print(f'\nAn unexpected error occurred: {str(e)}')
        sys.exit(1)
