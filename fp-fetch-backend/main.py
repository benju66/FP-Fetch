import sys
import json
import struct
from file_handler import process_payload

def read_message():
    """Reads a message from Chrome's Native Messaging host."""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        sys.exit(0)
    message_length = struct.unpack('@I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def send_message(message):
    """Sends a message back to the Chrome Extension."""
    encoded_message = json.dumps(message).encode('utf-8')
    # Pack the length of the message as a 4-byte integer
    sys.stdout.buffer.write(struct.pack('@I', len(encoded_message)))
    sys.stdout.buffer.write(encoded_message)
    sys.stdout.buffer.flush()

def main():
    while True:
        try:
            # 1. Wait for a message from the browser extension
            received_payload = read_message()

            # 2. Process the file and convert it
            response = process_payload(received_payload)

            # 3. Send success/error status back to the sidebar UI
            send_message(response)

        except Exception as e:
            send_message({"status": "error", "message": "Critical host failure: " + str(e)})
            sys.exit(1)

if __name__ == '__main__':
    main()
