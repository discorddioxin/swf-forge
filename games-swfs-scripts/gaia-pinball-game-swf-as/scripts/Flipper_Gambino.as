package
{
   import com.gaiaonline.games.gPinball.compound_elements.Flipper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol570")]
   public dynamic class Flipper_Gambino extends Flipper
   {
      
      public function Flipper_Gambino()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         stop();
      }
   }
}

