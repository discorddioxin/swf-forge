package
{
   import com.gaiaonline.games.gPinball.compound_elements.Flipper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol592")]
   public dynamic class Flipper_Right extends Flipper
   {
      
      public function Flipper_Right()
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

