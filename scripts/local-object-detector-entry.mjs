// Optional object detector: shipped with the Windows installer, never fetches cloud assets.
// The model detects objects, not conversations or mechanical operations.
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
let detectorPromise;
export async function detectObjectsLocally(canvas){
  if(!detectorPromise)detectorPromise=(async()=>{
    await tf.ready();
    const url=new URL('./models/ssdlite_mobilenet_v2/model.json',import.meta.url).href;
    return cocoSsd.load({base:'lite_mobilenet_v2',modelUrl:url});
  })().catch(error=>{detectorPromise=null;throw error;});
  return (await detectorPromise).detect(canvas,12,0.35);
}
