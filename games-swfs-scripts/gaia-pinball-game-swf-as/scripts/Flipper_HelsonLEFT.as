package
{
   import com.gaiaonline.games.gPinball.compound_elements.Flipper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1550")]
   public dynamic class Flipper_HelsonLEFT extends Flipper
   {
      
      public function Flipper_HelsonLEFT()
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

